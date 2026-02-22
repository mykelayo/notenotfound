// netlify/functions/read-note.js
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const UPSTASH_URL    = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN  = process.env.UPSTASH_REDIS_REST_TOKEN;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// ── Decrypt ───────────────────────────────────────────────────────────────────
function decrypt(encrypted) {
  const [ivHex, tagHex, dataHex] = encrypted.split(":");
  const iv   = Buffer.from(ivHex, "hex");
  const tag  = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const key  = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ── Hash password ─────────────────────────────────────────────────────────────
function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "cron-explain-salt").digest("hex");
}

// ── Redis GET ─────────────────────────────────────────────────────────────────
async function redisGet(key) {
  const res = await fetch(`${UPSTASH_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  const data = await res.json();
  return data.result;
}

// ── Redis DEL ─────────────────────────────────────────────────────────────────
async function redisDel(key) {
  await fetch(`${UPSTASH_URL}/del/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Use POST." }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON." }) }; }

  const { id, password, confirm } = body;

  if (!id)
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Note ID required." }) };

  // Fetch from Redis
  const raw = await redisGet(`note:${id}`);

  if (!raw)
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Note not found or already destroyed." }) };

  let note;
  try { note = JSON.parse(raw); }
  catch { return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Corrupted note." }) }; }

  // Check password if protected
  if (note.passwordHash) {
    if (!password)
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Password required.", passwordRequired: true }) };
    if (hashPassword(password) !== note.passwordHash)
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Incorrect password.", passwordRequired: true }) };
  }

  // If not confirmed yet — just return metadata (don't destroy yet)
  if (!confirm) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        exists:     true,
        hasPassword: !!note.passwordHash,
        createdAt:  note.createdAt,
        expiresAt:  note.expiresAt,
      }),
    };
  }

  // CONFIRMED — decrypt, delete, return content
  const content = decrypt(note.content);
  await redisDel(`note:${id}`);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ content, destroyed: true }),
  };
};
