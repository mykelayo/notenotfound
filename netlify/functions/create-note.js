// netlify/functions/create-note.js
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

// 32-byte AES key derived from ENCRYPTION_KEY using SHA-256
// Fast, deterministic, no CPU timeout risk on serverless
// MUST match deriveKey() in read-note.js exactly
function deriveKey() {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

// AES-256-GCM authenticated encryption
// Returns "ivHex:authTagHex:ciphertextHex"
function encrypt(plaintext) {
  const key    = deriveKey();
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("hex")).join(":");
}

function hashPassword(pw) {
  return crypto.createHash("sha256").update("nnf-v1:" + pw).digest("hex");
}

// ── Upstash Pipeline API ─────────────────────────────────────────────────────
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

  // Each result: { result: value } or { error: "message" }
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
    console.error("[create-note] Missing env vars:", {
      hasKey: !!ENCRYPTION_KEY, hasURL: !!UPSTASH_URL, hasToken: !!UPSTASH_TOKEN,
    });
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server not configured. Set ENCRYPTION_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN in Netlify." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON body." }) }; }

  const { content, password, expirySeconds } = body;

  if (typeof content !== "string" || !content.trim()) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note content is required." }) };
  }
  if (content.length > 10000) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note exceeds 10,000 character limit." }) };
  }

  const VALID_TTLS = [3600, 86400, 259200, 604800]; // 1h 24h 3d 7d
  const ttl = VALID_TTLS.includes(Number(expirySeconds)) ? Number(expirySeconds) : 86400;

  const id           = crypto.randomBytes(16).toString("hex");
  const encContent   = encrypt(content.trim());
  const passwordHash = (password && typeof password === "string" && password.trim())
    ? hashPassword(password.trim()) : null;

  // The note object stored as a plain JSON string in Redis
  const noteJson = JSON.stringify({
    v:            1,             // schema version — useful for future migrations
    content:      encContent,    // "ivHex:tagHex:ciphertextHex"
    passwordHash: passwordHash,  // SHA-256 hex or null
    createdAt:    Date.now(),
    expiresAt:    Date.now() + ttl * 1000,
  });

  // SET note:id noteJson EX ttl
  // The pipeline takes the exact Redis command as an array of strings.
  try {
    await upstash([
      ["SET", `note:${id}`, noteJson, "EX", String(ttl)],
    ]);
    console.log(`[create-note] Stored note:${id} TTL=${ttl}s hasPassword=${!!passwordHash}`);
  } catch (err) {
    console.error("[create-note] Upstash error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to save note. Try again." }) };
  }

  return {
    statusCode: 201,
    headers: CORS,
    body: JSON.stringify({ id, expiresAt: Date.now() + ttl * 1000 }),
  };
};