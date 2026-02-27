// src/config.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all site-wide constants.
// Change something here → it propagates to App.jsx, Terms.jsx, and index.html
// automatically. For index.html, see the comment block at the top of that file.
// ─────────────────────────────────────────────────────────────────────────────

// Your deployed site URL — no trailing slash
export const SITE_URL    = "https://notenotfound.netlify.app";

// Your GitHub repo URL
export const GITHUB_URL  = "https://github.com/mykelayo/notenotfound";

// Site branding
export const SITE_NAME   = "notenotfound";
export const AUTHOR      = "mykelayo";
export const TWITTER     = "@th3400l";

// Note limits — must match netlify/functions/config.js exactly
export const MAX_CHARS   = 10000;

// Expiry options shown in the UI — seconds values must match netlify/functions/config.js
export const EXPIRY_OPTIONS = [
  { label: "1 hour",   seconds: 3600   },
  { label: "24 hours", seconds: 86400  },
  { label: "3 days",   seconds: 259200 },
  { label: "7 days",   seconds: 604800 },
];
