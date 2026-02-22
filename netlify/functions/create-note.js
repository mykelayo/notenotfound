// netlify/functions/create-note.js

"use strict";
const crypto = require("crypto");

// .trim() prevents trailing newline bugs from copy-pasting env vars
const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || "").trim();
const UPSTASH_URL    = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN  = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

// Derive a stable 32-byte key from the ENCRYPTION_KEY string
// SHA-256 is deterministic, instant, and has no CPU timeout risk
// MUST match the derivation in read-note.js exactly
function deriveKey() {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

// AES-256-GCM authenticated encryption
// Returns "ivHex:authTagHex:encryptedHex" — all lowercase hex, joined by ":"
function encrypt(plaintext) {
  const key    = deriveKey();
  const iv     = crypto.randomBytes(12);              // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();                 // 128-bit auth tag
  return [iv, tag, enc].map((b) => b.toString("hex")).join(":");
}

// SHA-256 password hash — raw password never stored
// MUST match the hash in read-note.js exactly
function hashPassword(password) {
  return crypto.createHash("sha256").update("onetimote:" + password).digest("hex");
}

// Store a key → value in Upstash Redis with TTL
async function redisSet(key, value, ttlSeconds) {
  const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    // Upstash REST format: [value, option, optionValue]
    body: JSON.stringify([value, "EX", String(ttlSeconds)]),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Upstash SET failed (HTTP ${res.status}): ${text}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(`Upstash SET error: ${json.error}`);
  return json;
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  // Fail clearly if env vars are missing
  if (!ENCRYPTION_KEY || !UPSTASH_URL || !UPSTASH_TOKEN) {
    console.error("[create-note] FATAL: One or more env vars missing.", {
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

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { content, password, expirySeconds } = body;

  // Validate
  if (typeof content !== "string" || !content.trim()) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note content is required." }) };
  }
  if (content.length > 10000) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note exceeds 10,000 character limit." }) };
  }

  // Only accept specific TTL values — reject anything else
  const VALID_TTLS = [3600, 86400, 259200, 604800]; // 1h, 24h, 3d, 7d
  const ttl = VALID_TTLS.includes(Number(expirySeconds)) ? Number(expirySeconds) : 86400;

  // Build note
  const id           = crypto.randomBytes(16).toString("hex"); // 32-char unique ID
  const encContent   = encrypt(content.trim());
  const passwordHash =
    password && typeof password === "string" && password.trim()
      ? hashPassword(password.trim())
      : null;

  const noteJson = JSON.stringify({
    content:      encContent,      // "ivHex:tagHex:dataHex"
    passwordHash: passwordHash,    // SHA-256 hash or null
    createdAt:    Date.now(),
    expiresAt:    Date.now() + ttl * 1000,
  });

  // Save to Redis
  try {
    await redisSet(`note:${id}`, noteJson, ttl);
    console.log(`[create-note] Stored note ${id} TTL=${ttl}s hasPassword=${!!passwordHash}`);
  } catch (err) {
    console.error("[create-note] Redis error:", err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Failed to save note. Check Netlify function logs." }),
    };
  }

  return {
    statusCode: 201,
    headers: CORS,
    body: JSON.stringify({ id, expiresAt: Date.now() + ttl * 1000 }),
  };
};