# ¬ notenotfound

**Self-destructing encrypted notes. Share a secret — it vanishes after one read.**

Live → **[notenotfound.netlify.app](https://notenotfound.netlify.app)**

---

## What it does

Write a private note. Get a one-time link. Share it. The moment the recipient opens it and confirms, the note is decrypted, shown once, and **permanently deleted** from the database. The link is then dead forever — 404, note not found.

If never opened, it auto-deletes after your chosen expiry (1h / 24h / 3d / 7d).

---

## Features

- **AES-256-GCM encryption** — same standard used by Signal and iMessage. Encrypted before storage. We cannot read your notes.
- **Burn after reading** — deleted from the database the moment it's read.
- **Auto-expiry** — TTL enforced at the Redis level. Unread notes auto-delete.
- **Optional password protection** — lock the note with a password.
- **Zero logs** — no IPs, no content logging.
- **Free REST API** — create and read notes programmatically. No API key required.
- **Open source** — audit the code, fork it, self-host it.

---

## Stack

| Layer    | Tech                                      |
|----------|-------------------------------------------|
| Frontend | React + Vite                              |
| Backend  | Netlify Functions (Node.js, CommonJS)     |
| Database | Upstash Redis (serverless, free tier)     |
| Hosting  | Netlify                                   |

---

## Project structure

```
notenotfound/
├── netlify/functions/
│   ├── create-note.js    ← POST /api/create-note
│   └── read-note.js      ← POST /api/read-note
├── public/
│   ├── favicon.svg
│   ├── robots.txt
│   └── sitemap.xml
├── src/
│   ├── App.jsx           ← full app (create + read views)
│   └── main.jsx          ← React Router entry point
├── index.html            ← SEO, schema markup, OG tags
├── netlify.toml          ← build config, redirects, security headers
├── .env.example
└── .gitignore
```

---

## Local development

**You must use `netlify dev` — not `npm run dev`.**

`npm run dev` only starts Vite and can't serve `/api/*` routes. `netlify dev` runs both Vite and the Netlify Functions together.

```bash
# Prerequisites: Node 18+, Netlify CLI
npm install -g netlify-cli

git clone https://github.com/mykelayo/notenotfound
cd notenotfound
npm install

cp .env.example .env
# Edit .env with your real values

netlify dev   # ← always use this locally
```

---

## Environment variables

```env
# From upstash.com → your database → REST API tab
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Generate with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_64_char_hex_string
```

**On Netlify:** Site Settings → Environment Variables → add all three. Netlify injects them at runtime. They never touch GitHub.

> ⚠️ If you change `ENCRYPTION_KEY` after notes are stored, existing notes cannot be decrypted.

---

## Deployment

1. Create a free [Upstash](https://upstash.com) Redis database. Copy the REST URL and token.
2. Generate an encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. Push to GitHub. Connect repo to Netlify. Set the 3 env vars in the Netlify dashboard. Deploy.

---

## API

### Create a note

```
POST /api/create-note
Content-Type: application/json

{
  "content": "my secret",
  "password": "optional",
  "expirySeconds": 3600
}
```

Valid `expirySeconds`: `3600` (1h), `86400` (24h), `259200` (3d), `604800` (7d)

Response `201`: `{ "id": "abc123...", "expiresAt": 1735000000000 }`

Shareable link: `https://notenotfound.netlify.app/note/{id}`

---

### Read a note (two steps)

**Step 1 — check note exists (does NOT destroy it):**
```json
POST /api/read-note
{ "id": "abc123", "confirm": false }
```

**Step 2 — read and destroy (irreversible):**
```json
POST /api/read-note
{ "id": "abc123", "confirm": true, "password": "optional" }
```

Response `200`: `{ "content": "my secret", "destroyed": true }`  
Response `404`: note not found, already read, or expired

---

## Security

| Property         | Implementation                                      |
|------------------|-----------------------------------------------------|
| Encryption       | AES-256-GCM, random 96-bit IV per note              |
| Key derivation   | SHA-256 of `ENCRYPTION_KEY` env var                 |
| Password hashing | SHA-256 with fixed salt prefix                      |
| Storage          | Redis with TTL — database-level auto-expiry         |
| Transport        | HTTPS (Netlify TLS)                                 |
| Headers          | X-Frame-Options, XSS-Protection, Referrer-Policy   |

---

## License

MIT. Built by [mykelayo](https://github.com/mykelayo).