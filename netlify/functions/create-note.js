// netlify/functions/create-note.js
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-char secret set in Netlify env
const UPSTASH_URL    = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// ── Encrypt content with AES-256-GCM ─────────────────────────────────────────
function encrypt(text) {
  const iv  = crypto.randomBytes(12);
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(b => b.toString("hex")).join(":");
}

// ── Hash password ─────────────────────────────────────────────────────────────
function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "cron-explain-salt").digest("hex");
}

// ── Store in Upstash Redis ────────────────────────────────────────────────────
async function redisSet(key, value, ttlSeconds) {
  const res = await fetch(`${UPSTASH_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([value, "EX", ttlSeconds]),
  });
  return res.json();
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Use POST." }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON." }) }; }

  const { content, password, expirySeconds } = body;

  if (!content || typeof content !== "string" || content.trim().length === 0)
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note content is required." }) };

  if (content.length > 10000)
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note exceeds 10,000 character limit." }) };

  const allowedTTLs = [3600, 86400, 259200, 604800]; // 1h, 24h, 3d, 7d
  const ttl = allowedTTLs.includes(Number(expirySeconds)) ? Number(expirySeconds) : 86400;

  const id           = crypto.randomBytes(16).toString("hex");
  const encryptedContent = encrypt(content.trim());
  const passwordHash = password ? hashPassword(password) : null;

  const note = JSON.stringify({
    content:      encryptedContent,
    passwordHash,
    createdAt:    Date.now(),
    expiresAt:    Date.now() + ttl * 1000,
  });

  await redisSet(`note:${id}`, note, ttl);

  return {
    statusCode: 201,
    headers: CORS,
    body: JSON.stringify({ id, expiresAt: Date.now() + ttl * 1000 }),
  };
};
