// netlify/functions/read-note.js
"use strict";

const crypto = require("crypto");
const { NOTE_ID_REGEX, MAX_PASSWORD_LEN } = require("./config");

const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || "").trim();
const UPSTASH_URL    = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN  = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

// ── Crypto ────────────────────────────────────────────────────────────────────

// MUST match create-note.js deriveKey() exactly.
function deriveKey() {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

// Reverses create-note.js encrypt().
function decrypt(encryptedString) {
  const parts = encryptedString.split(":");
  if (parts.length !== 3) throw new Error(`Expected 3 colon-parts, got ${parts.length}`);
  const iv       = Buffer.from(parts[0], "hex");
  const tag      = Buffer.from(parts[1], "hex");
  const data     = Buffer.from(parts[2], "hex");
  const key      = deriveKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// MUST match create-note.js hashPassword() exactly.
function hashPassword(pw) {
  return crypto.createHash("sha256").update("nnf-v1:" + pw).digest("hex");
}

// ── Upstash Pipeline API ──────────────────────────────────────────────────────

async function upstash(commands) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Upstash pipeline HTTP ${res.status}: ${text}`);
  }

  const results = await res.json();
  for (const r of results) {
    if (r.error) throw new Error(`Upstash command error: ${r.error}`);
  }
  return results;
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  if (!ENCRYPTION_KEY || !UPSTASH_URL || !UPSTASH_TOKEN) {
    console.error("[read-note] Missing env vars:", {
      hasKey: !!ENCRYPTION_KEY, hasURL: !!UPSTASH_URL, hasToken: !!UPSTASH_TOKEN,
    });
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server not configured." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON body." }) }; }

  const { id, password, confirm } = body;

  // validate ID format before using it as a Redis key.
  // IDs are always 32 lowercase hex chars (crypto.randomBytes(16).toString("hex")).
  // Rejecting anything else prevents unexpected key construction.
  if (!id || typeof id !== "string") {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note ID is required." }) };
  }
  const cleanId = id.trim();
  if (!NOTE_ID_REGEX.test(cleanId)) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Note not found, already read, or expired." }) };
  }

  // cap password length to prevent oversized payload abuse
  if (password !== undefined && password !== null) {
    if (typeof password !== "string" || password.length > MAX_PASSWORD_LEN) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid password." }) };
    }
  }

  const noteKey = `note:${cleanId}`;

  // ── GET note from Redis ───────────────────────────────────────────────────
  let raw;
  try {
    const results = await upstash([["GET", noteKey]]);
    raw = results[0].result; // stored string, or null if not found / expired
  } catch (err) {
    console.error("[read-note] GET error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Database error. Try again." }) };
  }

  if (raw === null || raw === undefined) {
    return {
      statusCode: 404,
      headers: CORS,
      body: JSON.stringify({ error: "Note not found, already read, or expired." }),
    };
  }

  if (typeof raw !== "string") {
    console.error("[read-note] Expected string from Redis, got:", typeof raw, String(raw).slice(0, 100));
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Unexpected data type from database." }) };
  }

  let note;
  try {
    note = JSON.parse(raw);
  } catch (err) {
    console.error("[read-note] JSON.parse failed. raw[0..80]:", raw.slice(0, 80));
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Note data could not be parsed." }) };
  }

  if (!note || typeof note !== "object" || Array.isArray(note) || typeof note.content !== "string") {
    console.error("[read-note] Note has wrong shape. keys:", Object.keys(note || {}));
    return {
      statusCode: 500, headers: CORS,
      body: JSON.stringify({ error: "Note data is invalid. Please flush your database and redeploy. Old notes are incompatible." }),
    };
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

  // ── Step 1: confirm = false → return metadata only, note untouched ────────
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
  // If decrypt fails → note stays in Redis, user can retry.
  // If delete fails → TTL cleans it up, content is still returned.

  let content;
  try {
    content = decrypt(note.content);
  } catch (err) {
    console.error("[read-note] Decrypt failed:", err.message,
      "| keyLen:", ENCRYPTION_KEY.length,
      "| parts:", note.content.split(":").length);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Decryption failed. Note NOT deleted. Try again. If this persists, the ENCRYPTION_KEY may have changed." }),
    };
  }

  // Decrypt succeeded — now delete
  try {
    await upstash([["DEL", noteKey]]);
    console.log("[read-note] Note", cleanId, "read and destroyed successfully.");
  } catch (err) {
    // Non-fatal — content was decrypted successfully, TTL will clean up the key
    console.error("[read-note] DEL failed (non-fatal — TTL will clean up):", err.message);
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ content, destroyed: true }),
  };
};
