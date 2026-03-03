// netlify/functions/create-note.js
"use strict";

const crypto = require("crypto");
const {
  MAX_CHARS,
  MAX_PASSWORD_LEN,
  VALID_TTL_SECONDS,
  DEFAULT_TTL,
} = require("./config");

const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || "").trim();
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// Reject bodies larger than this before JSON.parse (defense-in-depth;
// Netlify's hard limit is 6 MB but we enforce our own tighter limit).
const MAX_BODY_BYTES = 64 * 1024; // 64 KB

// Rate limit: max requests per IP per window
const RL_CREATE_MAX = 10;
const RL_WINDOW_SEC = 60;

// ENCRYPTION_KEY must be at least 32 characters.
// SHA-256 always produces a 32-byte key regardless of input length, so a
// 3-character key would produce a crackable key that appears in rainbow tables.
const MIN_KEY_LEN = 32;

// ── Helpers ──────────────────────────────────────────────────────────────────


// ── Crypto ────────────────────────────────────────────────────────────────────

// 32-byte AES key derived from ENCRYPTION_KEY using SHA-256.
// MUST match deriveKey() in read-note.js exactly.
function deriveKey() {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

// AES-256-GCM authenticated encryption.
// Returns "ivHex:authTagHex:ciphertextHex".
function encrypt(plaintext) {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("hex")).join(":");
}

// Use PBKDF2 for new password hashes instead of bare SHA-256.
// PBKDF2 with 100,000 iterations takes ~10ms server-side — negligible for users,
// catastrophic for attackers attempting brute force.
// Format: "pbkdf2v1:<saltHex>:<hashHex>"
function hashPasswordV2(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(pw, salt, 100000, 32, "sha256");
  return `pbkdf2v1:${salt.toString("hex")}:${hash.toString("hex")}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// Never log the raw note ID. It is the shareable secret link.
// Log a 12-char SHA-256 prefix — useful for correlating log lines, useless to attackers.
function logId(id) {
  return crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 12) + "…";
}

// ── Upstash Pipeline API ──────────────────────────────────────────────────────

async function upstash(commands) {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
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

// ── Rate limiting via Upstash Redis ──────────────────────────────────────────
// Sliding window using atomic INCR + EXPIRE.
// Uses client-ip (set by Netlify CDN, not spoofable) as primary identifier.
// Falls back to x-forwarded-for first address only if client-ip is absent.

function getClientIp(event) {
  const clientIp = event.headers["client-ip"];
  if (clientIp) return clientIp.trim();
  const xff = (event.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xff || "unknown";
}

async function isRateLimited(ip) {
  // Sanitise IP before using as Redis key (prevent key injection)
  const safeIp = ip.replace(/[^a-zA-Z0-9.:_-]/g, "_").slice(0, 64);
  const key = `rl:create:${safeIp}`;
  try {
    // Atomic rate limit — SET NX guarantees key ALWAYS has a TTL.
    // If INCR ran but EXPIRE crashed (old approach), the key lived forever and the
    // IP would be permanently blocked. SET key 0 EX 60 NX + INCR is atomic:
    // SET only fires if key doesn't exist yet (NX), creating it with a TTL in one op.
    // INCR then increments. The key can never exist without a TTL.
    const results = await upstash([
      ["SET", key, "0", "EX", String(RL_WINDOW_SEC), "NX"],
      ["INCR", key],
    ]);
    return results[1].result > RL_CREATE_MAX;
  } catch {
    return false; // fail open: if Redis is down, don't block legitimate users
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  // Check raw body size before JSON.parse
  if ((event.body || "").length > MAX_BODY_BYTES) {
    return { statusCode: 413, headers: CORS, body: JSON.stringify({ error: "Request body too large." }) };
  }

  if (!ENCRYPTION_KEY || !UPSTASH_URL || !UPSTASH_TOKEN) {
    console.error("[create-note] Missing env vars:", {
      hasKey: !!ENCRYPTION_KEY, hasURL: !!UPSTASH_URL, hasToken: !!UPSTASH_TOKEN,
    });
    return {
      statusCode: 500, headers: CORS,
      body: JSON.stringify({ error: "Server not configured. Set ENCRYPTION_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN in Netlify." }),
    };
  }

  // Reject dangerously short ENCRYPTION_KEY values.
  // SHA-256 of a short key still produces 32 bytes, but the key space is tiny.
  if (ENCRYPTION_KEY.length < MIN_KEY_LEN) {
    console.error(`[create-note] ENCRYPTION_KEY too short (${ENCRYPTION_KEY.length} chars, need >= ${MIN_KEY_LEN})`);
    return {
      statusCode: 500, headers: CORS,
      body: JSON.stringify({ error: `ENCRYPTION_KEY must be at least ${MIN_KEY_LEN} characters. Update your Netlify environment variable.` }),
    };
  }

  // Rate limit by client IP
  const ip = getClientIp(event);
  if (await isRateLimited(ip)) {
    return {
      statusCode: 429, headers: { ...CORS, "Retry-After": String(RL_WINDOW_SEC) },
      body: JSON.stringify({ error: `Too many requests. Max ${RL_CREATE_MAX} notes per minute.` }),
    };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON body." }) }; }

  const { content, password, expirySeconds } = body;

  // Validate content
  if (typeof content !== "string" || !content.trim()) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note content is required." }) };
  }
  if (content.length > MAX_CHARS) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Note exceeds ${MAX_CHARS.toLocaleString()} character limit.` }) };
  }

  if (password !== undefined && password !== null) {
    if (typeof password !== "string") {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Password must be a string." }) };
    }
    if (password.length > MAX_PASSWORD_LEN) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Password too long (max ${MAX_PASSWORD_LEN} characters).` }) };
    }
  }

  const ttl = VALID_TTL_SECONDS.includes(Number(expirySeconds)) ? Number(expirySeconds) : DEFAULT_TTL;

  const id = crypto.randomBytes(16).toString("hex");
  const encContent = encrypt(content.trim());

  // Use PBKDF2 (v2) for new notes
  const passwordHash = (password && typeof password === "string" && password.trim())
    ? hashPasswordV2(password.trim()) : null;

  const noteJson = JSON.stringify({
    v: 2,             // schema version: 2 = PBKDF2 password hashing
    content: encContent,
    passwordHash: passwordHash,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttl * 1000,
  });

  try {
    await upstash([
      ["SET", `note:${id}`, noteJson, "EX", String(ttl)],
    ]);
    console.log(`[create-note] Stored note:${logId(id)} TTL=${ttl}s hasPassword=${!!passwordHash}`);
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
