// netlify/functions/read-note.js
"use strict";
const crypto = require("crypto");

const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || "").trim();
const UPSTASH_URL    = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN  = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

// MUST match create-note.js deriveKey() exactly
function deriveKey() {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

// Reverses create-note.js encrypt()
function decrypt(encryptedString) {
  const parts = encryptedString.split(":");
  if (parts.length !== 3) throw new Error(`Expected 3 parts, got ${parts.length}`);
  const iv       = Buffer.from(parts[0], "hex");
  const tag      = Buffer.from(parts[1], "hex");
  const data     = Buffer.from(parts[2], "hex");
  const key      = deriveKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// MUST match create-note.js hashPassword() exactly
function hashPassword(pw) {
  return crypto.createHash("sha256").update("nnf:" + pw).digest("hex");
}

// ── Upstash REST helpers ──────────────────────────────────────────────────────

async function redisGet(key) {
  const url = `${UPSTASH_URL}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method:  "GET",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Upstash GET failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(`Upstash GET error: ${json.error}`);
  // json.result is the stored string, or null if key doesn't exist / expired
  return json.result;
}

async function redisDel(key) {
  const url = `${UPSTASH_URL}/del/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method:  "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Upstash DEL failed (${res.status}): ${text}`);
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  if (!ENCRYPTION_KEY || !UPSTASH_URL || !UPSTASH_TOKEN) {
    console.error("[read-note] Missing env vars:", { hasKey: !!ENCRYPTION_KEY, hasURL: !!UPSTASH_URL, hasToken: !!UPSTASH_TOKEN });
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server not configured." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON body." }) }; }

  const { id, password, confirm } = body;

  if (!id || typeof id !== "string" || !id.trim()) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note ID is required." }) };
  }

  const noteKey = `note:${id.trim()}`;

  // Fetch raw string from Redis
  let raw;
  try { raw = await redisGet(noteKey); }
  catch (err) {
    console.error("[read-note] GET error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Database error. Try again." }) };
  }

  // null means key doesn't exist (not created, already read, or TTL expired)
  if (raw === null || raw === undefined) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Note not found, already read, or expired." }) };
  }

  // raw must be a string, if it's not, something went very wrong in storage
  if (typeof raw !== "string") {
    console.error("[read-note] raw is not a string, got:", typeof raw, JSON.stringify(raw).slice(0, 80));
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Note data type error. The note may have been stored incorrectly." }) };
  }

  // Parse the JSON string into a note object
  let note;
  try { note = JSON.parse(raw); }
  catch (err) {
    console.error("[read-note] JSON.parse failed. raw preview:", raw.slice(0, 80));
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Note data corrupted." }) };
  }

  // Validate note has expected shape
  if (!note || typeof note !== "object" || Array.isArray(note)) {
    console.error("[read-note] Parsed note is not an object:", typeof note);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Note data malformed." }) };
  }
  if (typeof note.content !== "string" || note.content.length === 0) {
    console.error("[read-note] note.content missing or empty. Keys present:", Object.keys(note));
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Note content missing from storage." }) };
  }

  // ── Password check ────────────────────────────────────────────────────────
  if (note.passwordHash) {
    if (!password || typeof password !== "string" || !password.trim()) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Password required.", passwordRequired: true }) };
    }
    if (hashPassword(password.trim()) !== note.passwordHash) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Incorrect password.", passwordRequired: true }) };
    }
  }

  // ── Step 1: confirm = false → metadata only, note untouched ─────────────
  if (!confirm) {
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

  // ── Step 2: confirm = true → decrypt FIRST, then delete ──────────────────
  // Order: decrypt → if successful → delete → return content
  // If decrypt fails: note is NOT deleted, user gets error and can retry

  let content;
  try {
    content = decrypt(note.content);
  } catch (err) {
    // Note is still in Redis, not deleted
    console.error("[read-note] Decrypt failed for note:", id.trim(), "| error:", err.message,
      "| content parts:", note.content.split(":").length,
      "| KEY length:", ENCRYPTION_KEY.length);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Decryption failed. The note has NOT been deleted — try again." }),
    };
  }

  // Decrypt succeeded, now delete
  try {
    await redisDel(noteKey);
    console.log("[read-note] Note", id.trim(), "read and destroyed.");
  } catch (err) {
    // Log but don't fail, TTL will clean it up
    console.error("[read-note] DEL failed (non-fatal, TTL cleans up):", err.message);
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ content, destroyed: true }),
  };
};