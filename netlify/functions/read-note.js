// netlify/functions/read-note

"use strict";
const crypto = require("crypto");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const UPSTASH_URL    = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

// Must use the EXACT same salt as create-note.js
function decrypt(encryptedString) {
  const parts = encryptedString.split(":");
  if (parts.length !== 3) throw new Error("Invalid format — expected iv:tag:data");
  const iv       = Buffer.from(parts[0], "hex");
  const tag      = Buffer.from(parts[1], "hex");
  const data     = Buffer.from(parts[2], "hex");
  const key      = crypto.scryptSync(ENCRYPTION_KEY, "onetimote-v1-salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// Must match create-note.js exactly
function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw + "onetimote-pw-v1").digest("hex");
}

// Step 1 helper: GET metadata without destroying the note
async function redisGet(key) {
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Upstash GET failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.result;
}

// Step 2 helper: GETDEL — atomically reads the value AND deletes the key
async function redisGetDel(key) {
  const res = await fetch(`${UPSTASH_URL}/getdel/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Upstash GETDEL failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.result; // null if key didn't exist; value if it did (now deleted)
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  // Guard: fail loudly if env vars not configured
  if (!ENCRYPTION_KEY || !UPSTASH_URL || !UPSTASH_TOKEN) {
    console.error("[read-note] FATAL: Missing env vars. Configure in Netlify dashboard.");
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server not configured." }) };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Request body must be valid JSON." }) };
  }

  const { id, password, confirm } = body;

  if (!id || typeof id !== "string" || !id.trim()) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note ID is required." }) };
  }

  const noteKey = `note:${id.trim()}`;

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: confirm = false  →  return metadata only, do NOT destroy
  // ═══════════════════════════════════════════════════════════════════════════
  if (!confirm) {
    let raw;
    try {
      raw = await redisGet(noteKey);
    } catch (err) {
      console.error("[read-note] GET error:", err.message);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Database error." }) };
    }

    if (raw === null || raw === undefined) {
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({ error: "Note not found, already read, or expired." }),
      };
    }

    let note;
    try {
      note = JSON.parse(raw);
    } catch {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Note data corrupted." }) };
    }

    // Password check for metadata step
    if (note.passwordHash) {
      if (!password || typeof password !== "string" || !password.trim()) {
        return {
          statusCode: 401,
          headers: CORS,
          body: JSON.stringify({ error: "Password required.", passwordRequired: true }),
        };
      }
      if (hashPassword(password.trim()) !== note.passwordHash) {
        return {
          statusCode: 403,
          headers: CORS,
          body: JSON.stringify({ error: "Incorrect password.", passwordRequired: true }),
        };
      }
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        exists:      true,
        hasPassword: !!note.passwordHash,
        createdAt:   note.createdAt,
        expiresAt:   note.expiresAt,
      }),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: confirm = true  →  GETDEL (atomic read + destroy), decrypt, return
  // ═══════════════════════════════════════════════════════════════════════════
  let raw;
  try {
    raw = await redisGetDel(noteKey);
  } catch (err) {
    console.error("[read-note] GETDEL error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Database error." }) };
  }

  // GETDEL returned null — note was never there, already consumed, or expired
  if (raw === null || raw === undefined) {
    return {
      statusCode: 404,
      headers: CORS,
      body: JSON.stringify({ error: "Note not found, already read, or expired." }),
    };
  }

  // Parse note data
  let note;
  try {
    note = JSON.parse(raw);
  } catch {
    // GETDEL already deleted it — we can't recover. Log and return error.
    console.error("[read-note] Note JSON corrupted after GETDEL for id:", id.trim());
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Note data was corrupted." }) };
  }

  // Password check before revealing content
  if (note.passwordHash) {
    if (!password || typeof password !== "string" || !password.trim()) {
      console.error("[read-note] Password required but not provided at confirm step for id:", id.trim());
      return {
        statusCode: 401,
        headers: CORS,
        body: JSON.stringify({ error: "Password required.", passwordRequired: true }),
      };
    }
    if (hashPassword(password.trim()) !== note.passwordHash) {
      // Same situation — note already deleted, wrong password at confirm step.
      console.error("[read-note] Wrong password at confirm step for id:", id.trim());
      return {
        statusCode: 403,
        headers: CORS,
        body: JSON.stringify({ error: "Incorrect password.", passwordRequired: true }),
      };
    }
  }

  // Decrypt
  let content;
  try {
    content = decrypt(note.content);
  } catch (err) {
    // GETDEL already deleted the note. Content is unrecoverable.
    // This means ENCRYPTION_KEY may have changed since the note was created.
    console.error("[read-note] Decrypt failed (key mismatch?) for id:", id.trim(), err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Failed to decrypt note. The encryption key may have changed." }),
    };
  }

  console.log(`[read-note] Note ${id.trim()} successfully read and destroyed.`);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ content: content, destroyed: true }),
  };
};