// netlify/functions/config.js
// ─────────────────────────────────────────────────────────────────────────────
// Backend constants shared by create-note.js and read-note.js.
// Keep the values here in sync with src/config.js (the frontend version).
// CommonJS format — required by Netlify Functions (Node.js).
// ─────────────────────────────────────────────────────────────────────────────

// Maximum note size in characters — must match MAX_CHARS in src/config.js
const MAX_CHARS = 10000;

// Maximum password length to prevent oversized payload abuse
const MAX_PASSWORD_LEN = 1000;

// Valid expiry values in seconds — must match EXPIRY_OPTIONS in src/config.js
const VALID_TTL_SECONDS = [3600, 86400, 259200, 604800];

// Default TTL if none provided or an invalid value is sent
const DEFAULT_TTL = 86400; // 24 hours

// Note ID format: 32 lowercase hex chars (from crypto.randomBytes(16).toString("hex"))
const NOTE_ID_REGEX = /^[a-f0-9]{32}$/;

module.exports = {
  MAX_CHARS,
  MAX_PASSWORD_LEN,
  VALID_TTL_SECONDS,
  DEFAULT_TTL,
  NOTE_ID_REGEX,
};
