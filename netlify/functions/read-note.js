// netlify/functions/read-note.js
//
// Two-step read flow — prevents accidental note destruction:
//   Step 1: POST { id, confirm: false }         → metadata only, note NOT destroyed
//   Step 2: POST { id, confirm: true  }         → decrypt + destroy (irreversible)
//   Password: include { password: "..." } in either step if note is protected

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

// Must use same salt as create-note.js
function decrypt(encryptedString) {
  const parts = encryptedString.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted format (expected iv:tag:data)");
  const iv      = Buffer.from(parts[0], "hex");
  const tag     = Buffer.from(parts[1], "hex");
  const data    = Buffer.from(parts[2], "hex");
  const key     = crypto.scryptSync(ENCRYPTION_KEY, "onetimote-v1-salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// Must match create-note.js exactly
function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw + "onetimote-pw-v1").digest("hex");
}

async function redisGet(key) {
  const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "unknown");
    throw new Error(`Upstash GET error ${res.status}: ${body}`);
  }
  const json = await res.json();
  return json.result; // null if key does not exist
}

async function redisDel(key) {
  const res = await fetch(`${UPSTASH_URL}/del/${encodeURIComponent(key)}`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "unknown");
    throw new Error(`Upstash DEL error ${res.status}: ${body}`);
  }
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  if (!ENCRYPTION_KEY || !UPSTASH_URL || !UPSTASH_TOKEN) {
    console.error("[read-note] FATAL: Missing env vars.");
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server not configured." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Request body must be valid JSON." }) };
  }

  const { id, password, confirm } = body;

  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note ID is required." }) };
  }

  const noteKey = `note:${id.trim()}`;

  // ── Fetch from Redis ──────────────────────────────────────────────────────
  let raw;
  try {
    raw = await redisGet(noteKey);
  } catch (err) {
    console.error("[read-note] Redis GET error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Database error." }) };
  }

  if (raw === null || raw === undefined) {
    return {
      statusCode: 404,
      headers: CORS,
      body: JSON.stringify({ error: "Note not found. It may have already been read or has expired." }),
    };
  }

  // ── Parse ─────────────────────────────────────────────────────────────────
  let note;
  try {
    note = JSON.parse(raw);
  } catch {
    console.error("[read-note] Failed to parse note JSON for key:", noteKey);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Note data corrupted." }) };
  }

  // ── Password check ────────────────────────────────────────────────────────
  if (note.passwordHash) {
    if (!password || typeof password !== "string" || !password.trim()) {
      return {
        statusCode: 401,
        headers: CORS,
        body: JSON.stringify({ error: "This note is password protected.", passwordRequired: true }),
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

  // ── Step 1: confirm = false → return metadata only ────────────────────────
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

  // ── Step 2: confirm = true → decrypt + destroy ────────────────────────────
  let content;
  try {
    content = decrypt(note.content);
  } catch (err) {
    console.error("[read-note] Decrypt failed:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to decrypt note." }) };
  }

  // Delete from Redis immediately — this is what makes it one-time
  try {
    await redisDel(noteKey);
    console.log(`[read-note] Note ${id.trim()} read and destroyed.`);
  } catch (err) {
    // Non-fatal: TTL will expire the key eventually even if delete fails
    console.error("[read-note] Redis DEL failed (non-fatal, TTL will clean up):", err.message);
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ content, destroyed: true }),
  };
};
