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

// Reverses what create-note.js encrypt() produces
function decrypt(encryptedString) {
  const parts = encryptedString.split(":");
  if (parts.length !== 3) {
    throw new Error(`Bad format: expected 3 colon-separated parts, got ${parts.length}`);
  }
  const iv       = Buffer.from(parts[0], "hex");
  const tag      = Buffer.from(parts[1], "hex");
  const data     = Buffer.from(parts[2], "hex");
  const key      = deriveKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// MUST match create-note.js hashPassword() exactly
function hashPassword(password) {
  return crypto.createHash("sha256").update("onetimote:" + password).digest("hex");
}

// Fetch a value from Upstash without deleting it
async function redisGet(key) {
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    method:  "GET",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Upstash GET failed (HTTP ${res.status}): ${text}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(`Upstash GET error: ${json.error}`);
  return json.result; // string value, or null if key doesn't exist
}

// Delete a key from Upstash
async function redisDel(key) {
  const res = await fetch(`${UPSTASH_URL}/del/${encodeURIComponent(key)}`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Upstash DEL failed (HTTP ${res.status}): ${text}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(`Upstash DEL error: ${json.error}`);
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  if (!ENCRYPTION_KEY || !UPSTASH_URL || !UPSTASH_TOKEN) {
    console.error("[read-note] FATAL: Missing env vars.", {
      hasKey:   !!ENCRYPTION_KEY,
      hasURL:   !!UPSTASH_URL,
      hasToken: !!UPSTASH_TOKEN,
    });
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Server not configured. Set env vars in Netlify dashboard." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { id, password, confirm } = body;

  if (!id || typeof id !== "string" || !id.trim()) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note ID is required." }) };
  }

  const noteKey = `note:${id.trim()}`;

  // ── Fetch note from Redis (same for both steps) ───────────────────────────
  let raw;
  try {
    raw = await redisGet(noteKey);
  } catch (err) {
    console.error("[read-note] Redis GET error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Database error. Try again." }) };
  }

  if (raw === null || raw === undefined) {
    return {
      statusCode: 404,
      headers: CORS,
      body: JSON.stringify({ error: "Note not found, already read, or expired." }),
    };
  }

  // Parse stored JSON
  let note;
  try {
    note = JSON.parse(raw);
  } catch (err) {
    console.error("[read-note] JSON.parse failed:", err.message, "raw:", raw?.slice(0, 80));
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Note data corrupted." }) };
  }

  // Validate note shape
  if (!note.content || typeof note.content !== "string") {
    console.error("[read-note] Note missing content field. Keys:", Object.keys(note));
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Note data invalid." }) };
  }

  // ── Password check (applies to both Step 1 and Step 2) ───────────────────
  if (note.passwordHash) {
    if (!password || typeof password !== "string" || !password.trim()) {
      return {
        statusCode: 401,
        headers: CORS,
        body: JSON.stringify({ error: "Password required.", passwordRequired: true }),
      };
    }
    const provided = hashPassword(password.trim());
    if (provided !== note.passwordHash) {
      console.log("[read-note] Wrong password for note", id.trim());
      return {
        statusCode: 403,
        headers: CORS,
        body: JSON.stringify({ error: "Incorrect password.", passwordRequired: true }),
      };
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1: confirm = false → return metadata only, do NOT delete note
  // ══════════════════════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2: confirm = true → decrypt FIRST, delete AFTER success
  //
  // Order matters:
  //   1. Decrypt — if this fails, note is NOT deleted, user gets error and can retry
  //   2. Delete  — only called after content is successfully decrypted
  //   3. Return content
  // ══════════════════════════════════════════════════════════════════════════

  // Decrypt first — if this fails, note stays in Redis
  let content;
  try {
    content = decrypt(note.content);
  } catch (err) {
    // Note is still in Redis — not deleted — user can retry
    console.error(
      "[read-note] Decrypt FAILED for note", id.trim(),
      "| Error:", err.message,
      "| content field length:", note.content?.length,
      "| content preview:", note.content?.slice(0, 40),
      "| ENCRYPTION_KEY length:", ENCRYPTION_KEY.length
    );
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({
        error: "Failed to decrypt this note. The note has NOT been deleted, please contact support with the note ID.",
        noteId: id.trim(),
      }),
    };
  }

  // Decrypt succeeded — now delete from Redis
  try {
    await redisDel(noteKey);
    console.log("[read-note] Note", id.trim(), "read and destroyed.");
  } catch (err) {
    // Delete failed — log it but still return the content to the user
    // The note will be cleaned up by its Redis TTL
    console.error("[read-note] DEL failed (non-fatal, TTL will clean up):", err.message);
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ content: content, destroyed: true }),
  };
};