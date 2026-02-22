// netlify/functions/create-note.js

"use strict";
const crypto = require("crypto");

// ─── Secrets ────────────────────────────────────────────────────────────────
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const UPSTASH_URL    = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type":                 "application/json",
};

// AES-256-GCM: authenticated encryption
// Returns "ivHex:tagHex:dataHex"
function encrypt(plaintext) {
  const iv     = crypto.randomBytes(12);
  const key    = crypto.scryptSync(ENCRYPTION_KEY, "onetimote-v1-salt", 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("hex")).join(":");
}

function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw + "onetimote-pw-v1").digest("hex");
}

async function redisSet(key, value, ttlSeconds) {
  const url = `${UPSTASH_URL}/set/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([value, "EX", String(ttlSeconds)]),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "unknown");
    throw new Error(`Upstash error ${res.status}: ${body}`);
  }
  return res.json();
}

exports.handler = async function (event) {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  // Guard: environment variables must be configured in Netlify dashboard
  if (!ENCRYPTION_KEY || !UPSTASH_URL || !UPSTASH_TOKEN) {
    console.error("[create-note] FATAL: Missing env vars. Set ENCRYPTION_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN in Netlify dashboard.");
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server not configured. Contact the site owner." }) };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Request body must be valid JSON." }) };
  }

  const { content, password, expirySeconds } = body;

  // Validate content
  if (typeof content !== "string" || content.trim().length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note content is required." }) };
  }
  if (content.length > 10000) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note exceeds 10,000 character limit." }) };
  }

  // Validate expiry — only exact values accepted
  const VALID_TTLS = [3600, 86400, 259200, 604800];
  const ttl = VALID_TTLS.includes(Number(expirySeconds)) ? Number(expirySeconds) : 86400;

  // Build and save note
  const id           = crypto.randomBytes(16).toString("hex");
  const encContent   = encrypt(content.trim());
  const passwordHash = (password && typeof password === "string" && password.trim())
    ? hashPassword(password.trim())
    : null;

  const noteJson = JSON.stringify({
    content:      encContent,
    passwordHash: passwordHash,
    createdAt:    Date.now(),
    expiresAt:    Date.now() + ttl * 1000,
  });

  try {
    await redisSet(`note:${id}`, noteJson, ttl);
  } catch (err) {
    console.error("[create-note] Redis error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to save note. Please try again." }) };
  }

  console.log(`[create-note] Created note ${id} TTL=${ttl}s hasPassword=${!!passwordHash}`);

  return {
    statusCode: 201,
    headers: CORS,
    body: JSON.stringify({ id, expiresAt: Date.now() + ttl * 1000 }),
  };
};
