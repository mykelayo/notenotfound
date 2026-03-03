// netlify/functions/read-note.js
"use strict";

const crypto = require("crypto");
const { NOTE_ID_REGEX, MAX_PASSWORD_LEN } = require("./config");

const ENCRYPTION_KEY = (process.env.ENCRYPTION_KEY || "").trim();
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

const MAX_BODY_BYTES = 8 * 1024; // 8 KB — read requests are tiny
const MIN_KEY_LEN = 32;

// Rate limit: max read requests per IP per window
const RL_READ_MAX = 30;
const RL_WINDOW_SEC = 60;

// ── Crypto ────────────────────────────────────────────────────────────────────

function deriveKey() {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

function decrypt(encryptedString) {
  const parts = encryptedString.split(":");
  if (parts.length !== 3) throw new Error(`Expected 3 colon-parts, got ${parts.length}`);
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const data = Buffer.from(parts[2], "hex");
  const key = deriveKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// Support both v1 (SHA-256, legacy) and v2 (PBKDF2, new notes).
// Legacy notes created before the security fix continue to work.
function hashPasswordV1(pw) {
  return crypto.createHash("sha256").update("nnf-v1:" + pw).digest("hex");
}

function verifyPasswordV2(pw, storedHash) {
  // Format: "pbkdf2v1:<saltHex>:<hashHex>"
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "pbkdf2v1") return false;
  const salt = Buffer.from(parts[1], "hex");
  const hash = Buffer.from(parts[2], "hex");
  const derived = crypto.pbkdf2Sync(pw, salt, 100000, 32, "sha256");
  // timing-safe comparison
  try { return crypto.timingSafeEqual(derived, hash); } catch { return false; }
}

// Timing-safe password verification dispatches to the right
// scheme based on the stored hash format, and uses timingSafeEqual throughout.
function verifyPassword(pw, storedHash) {
  if (!storedHash) return true; // no password set
  if (storedHash.startsWith("pbkdf2v1:")) {
    // v2: PBKDF2 — new notes
    return verifyPasswordV2(pw, storedHash);
  }
  // v1: legacy SHA-256 — compare timing-safely
  const provided = Buffer.from(hashPasswordV1(pw), "hex");
  const stored = Buffer.from(storedHash, "hex");
  try { return crypto.timingSafeEqual(provided, stored); } catch { return false; }
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

// ── Rate limiting ─────────────────────────────────────────────────────────────

function getClientIp(event) {
  const clientIp = event.headers["client-ip"];
  if (clientIp) return clientIp.trim();
  return (event.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

async function isRateLimited(ip) {
  const safeIp = ip.replace(/[^a-zA-Z0-9.:_-]/g, "_").slice(0, 64);
  const key = `rl:read:${safeIp}`;
  try {
    // Atomic rate limit — SET NX guarantees key ALWAYS has a TTL.
    // Old approach (INCR + EXPIRE) was non-atomic: a crash between the two commands
    // left the key with no TTL, permanently blocking the IP.
    const results = await upstash([
      ["SET", key, "0", "EX", String(RL_WINDOW_SEC), "NX"],
      ["INCR", key],
    ]);
    return results[1].result > RL_READ_MAX;
  } catch {
    return false;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// Never log the raw note ID — it IS the shareable one-time link.
// Anyone with Netlify log access could harvest note IDs and read secrets.
// Log a 12-char SHA-256 prefix instead: correlatable across log lines, not exploitable.
function logId(id) {
  return crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 12) + "…";
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  // body size guard before JSON.parse
  if ((event.body || "").length > MAX_BODY_BYTES) {
    return { statusCode: 413, headers: CORS, body: JSON.stringify({ error: "Request body too large." }) };
  }

  if (!ENCRYPTION_KEY || !UPSTASH_URL || !UPSTASH_TOKEN) {
    console.error("[read-note] Missing env vars:", {
      hasKey: !!ENCRYPTION_KEY, hasURL: !!UPSTASH_URL, hasToken: !!UPSTASH_TOKEN,
    });
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server not configured." }) };
  }

  // enforce minimum key length
  if (ENCRYPTION_KEY.length < MIN_KEY_LEN) {
    console.error(`[read-note] ENCRYPTION_KEY too short (${ENCRYPTION_KEY.length} chars)`);
    return {
      statusCode: 500, headers: CORS,
      body: JSON.stringify({ error: `ENCRYPTION_KEY must be at least ${MIN_KEY_LEN} characters.` }),
    };
  }

  // rate limit by client IP
  const ip = getClientIp(event);
  if (await isRateLimited(ip)) {
    return {
      statusCode: 429, headers: { ...CORS, "Retry-After": String(RL_WINDOW_SEC) },
      body: JSON.stringify({ error: `Too many requests. Max ${RL_READ_MAX} reads per minute.` }),
    };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON body." }) }; }

  const { id, password, confirm } = body;

  if (!id || typeof id !== "string") {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note ID is required." }) };
  }
  const cleanId = id.trim();
  if (!NOTE_ID_REGEX.test(cleanId)) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Note not found, already read, or expired." }) };
  }

  if (password !== undefined && password !== null) {
    if (typeof password !== "string" || password.length > MAX_PASSWORD_LEN) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid password." }) };
    }
  }

  const noteKey = `note:${cleanId}`;

  // For confirm=false (metadata check), we use GET so the note is untouched.
  // For confirm=true (final read), we use GETDEL — atomic get-and-delete.
  // GETDEL closes the TOCTOU race window. Previously,
  // GET + separate DEL left a ~16ms window during which a second concurrent
  // request could also GET the note and read it. GETDEL is atomic: the first
  // caller gets the value, all concurrent callers get null.
  const useGetDel = !!confirm;
  let raw;
  try {
    const cmd = useGetDel ? ["GETDEL", noteKey] : ["GET", noteKey];
    const results = await upstash([cmd]);
    raw = results[0].result;
  } catch (err) {
    console.error("[read-note] GET error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Database error. Try again." }) };
  }

  if (raw === null || raw === undefined) {
    // Equalise timing with the wrong-password path.
    // Without this, a caller supplying a password gets a fast 404 (Redis miss, no PBKDF2)
    // for a non-existent note and a slow 404 (~19 ms slower) for an existing note with a
    // wrong password. The latency difference is a timing oracle that reveals note existence
    // even though both paths now return 404. Running a dummy PBKDF2 here closes the gap.
    if (password && typeof password === "string" && password.trim()) {
      crypto.pbkdf2Sync(password.trim(), crypto.randomBytes(16), 100000, 32, "sha256");
    }
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

  // ── Password check ─────────────────────────────────────────────────────────
  // verifyPassword() uses crypto.timingSafeEqual throughout.
  // Wrong password returns 404 (same as not found) to collapse
  // the existence oracle. Previously 401 = note exists, 404 = note doesn't exist,
  // which let an attacker enumerate live note IDs from a candidate list.
  if (note.passwordHash) {
    if (!password || typeof password !== "string" || !password.trim()) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Password required.", passwordRequired: true }) };
    }
    if (!verifyPassword(password.trim(), note.passwordHash)) {
      // Return 404 instead of 403 — same response as "note not found".
      // This ensures an attacker cannot distinguish a wrong password on an existing
      // note from a note that doesn't exist, collapsing the existence oracle.
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Note not found, already read, or expired." }) };
    }
  }

  // ── Step 1: confirm !== true → metadata only, note untouched ──────────────
  // Strict === true check. Previously any truthy value (1, "yes", {})
  // would skip this gate and go straight to decrypt+destroy in a single request.
  if (confirm !== true) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        exists: true,
        hasPassword: !!note.passwordHash,
        createdAt: note.createdAt,
        expiresAt: note.expiresAt,
      }),
    };
  }

  // ── Step 2: confirm = true → decrypt first, then delete ───────────────────
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

  // Note was already atomically deleted by GETDEL above.
  // No separate DEL needed — that was the old non-atomic pattern.
  console.log("[read-note] Note", logId(cleanId), "read and destroyed successfully.");

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ content, destroyed: true }),
  };
};
