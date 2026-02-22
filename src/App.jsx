// src/App.jsx

import { useState, useEffect } from "react";

const GITHUB    = "https://github.com/mykelayo/onetimenote";
const MAX_CHARS = 10000;

const EXPIRY_OPTIONS = [
  { label: "1 hour",   seconds: 3600   },
  { label: "24 hours", seconds: 86400  },
  { label: "3 days",   seconds: 259200 },
  { label: "7 days",   seconds: 604800 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNoteIdFromURL() {
  const match = window.location.pathname.match(/^\/note\/([a-f0-9]{32})$/);
  return match ? match[1] : null;
}

function getShareableLink(id) {
  return `${window.location.origin}/note/${id}`;
}

function formatExpiry(seconds) {
  if (seconds <= 3600)   return "1 hour";
  if (seconds <= 86400)  return "24 hours";
  if (seconds <= 259200) return "3 days";
  return "7 days";
}

function timeAgo(ts) {
  const mins  = Math.floor((Date.now() - ts) / 60000);
  const hours = Math.floor(mins / 60);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${hours}h ago`;
}

function track(name, params = {}) {
  if (typeof window.gtag === "function") window.gtag("event", name, params);
}

// ── safeFetch ─────────────────────────────────────────────────────────────────
// Checks Content-Type before calling .json()
// Prevents "Unexpected end of JSON" when Vite dev server returns HTML for /api/* routes
// Locally: use `netlify dev` — NOT `npm run dev` — or API calls will fail
async function safeFetch(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw new Error("Network error. Check your connection.");
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    if (res.status === 404) {
      throw new Error(
        "API route not found. If running locally, use `netlify dev` instead of `npm run dev`."
      );
    }
    throw new Error(`Unexpected server response (${res.status}). Check Netlify function logs.`);
  }

  const data = await res.json();
  return { data, status: res.status, ok: res.ok };
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function apiCreateNote(content, password, expirySeconds) {
  const { data, ok } = await safeFetch("/api/create-note", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ content, password: password || null, expirySeconds }),
  });
  if (!ok) throw new Error(data.error || "Failed to create note.");
  return data;
}

// Step 1: check note exists, get metadata — does NOT destroy note
async function apiCheckNote(id, password) {
  const body = { id, confirm: false };
  if (password) body.password = password;
  const { data, status } = await safeFetch("/api/read-note", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  return { ...data, _status: status };
}

// Step 2: read content and destroy note
async function apiDestroyNote(id, password) {
  const body = { id, confirm: true };
  if (password) body.password = password;
  const { data, status, ok } = await safeFetch("/api/read-note", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  return { ...data, _status: status, _ok: ok };
}

// ── Create View ───────────────────────────────────────────────────────────────

function CreateView() {
  const [content,  setContent]  = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [expiry,   setExpiry]   = useState(86400);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [copied,   setCopied]   = useState(false);
  const [error,    setError]    = useState(null);

  const chars     = content.length;
  const overLimit = chars > MAX_CHARS;
  const nearLimit = chars > MAX_CHARS * 0.8;
  const canSubmit = content.trim().length > 0 && !overLimit && !loading;

  async function handleCreate() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiCreateNote(content.trim(), password.trim(), expiry);
      setResult(data);
      track("note_created", { expiry_seconds: expiry, has_password: !!password });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(getShareableLink(result.id));
    setCopied(true);
    track("link_copied");
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setResult(null); setContent(""); setPassword("");
    setExpiry(86400); setError(null); setCopied(false);
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div style={S.card} className="fade-in">
        <div style={S.successTop}>
          <div style={S.successRing}><span style={S.successCheck}>✓</span></div>
          <div>
            <h2 style={S.cardTitle}>Note created.</h2>
            <p style={S.cardSub}>
              Expires in <strong style={{ color: C.amber }}>{formatExpiry(expiry)}</strong>{" "}
              or after one read — whichever comes first.
            </p>
          </div>
        </div>

        <div style={S.linkCard}>
          <div style={S.linkLabel}>ONE-TIME LINK</div>
          <div style={S.linkValue}>{getShareableLink(result.id)}</div>
          <button
            style={{ ...S.amberBtn, ...(copied ? S.amberBtnDone : {}) }}
            onClick={copyLink}
            className="amber-btn"
          >
            {copied ? "✓ Copied to clipboard" : "Copy link"}
          </button>
        </div>

        {password && (
          <div style={S.warningBox}>
            <span style={S.warningIcon}>🔒</span>
            <span>Share the password separately — <strong>never</strong> in the same message as the link.</span>
          </div>
        )}

        <button style={S.ghostBtn} onClick={reset} className="ghost-btn">← Write another note</button>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div style={S.card}>
      <div>
        <h2 style={S.cardTitle}>Write your secret note</h2>
        <p style={S.cardSub}>End-to-end encrypted. Permanently destroyed after one read.</p>
      </div>

      <div style={S.fieldGroup}>
        <textarea
          style={{ ...S.textarea, ...(overLimit ? S.textareaErr : {}) }}
          placeholder="Passwords, API keys, private messages, sensitive info..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={7}
          className="note-textarea"
          aria-label="Note content"
        />
        <div style={S.charRow}>
          {overLimit  && <span style={S.charErr}>Over limit — trim your note</span>}
          {nearLimit && !overLimit && <span style={S.charWarn}>{(MAX_CHARS - chars).toLocaleString()} left</span>}
          {!nearLimit && !overLimit && <span />}
          <span style={{ ...S.charNum, color: overLimit ? C.red : nearLimit ? C.amber : C.muted }}>
            {chars.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>
      </div>

      <div style={S.optionsGrid}>
        <div style={S.optBlock}>
          <label style={S.optLabel}>EXPIRES IN</label>
          <div style={S.segGroup}>
            {EXPIRY_OPTIONS.map((opt) => (
              <button
                key={opt.seconds}
                style={{ ...S.seg, ...(expiry === opt.seconds ? S.segOn : {}) }}
                className={`seg ${expiry === opt.seconds ? "seg-on" : ""}`}
                onClick={() => setExpiry(opt.seconds)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={S.optBlock}>
          <label style={S.optLabel}>PASSWORD <span style={S.optHint}>— OPTIONAL</span></label>
          <div style={S.passRow}>
            <input
              style={S.passInput}
              type={showPass ? "text" : "password"}
              placeholder="Leave blank for no password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pass-input"
            />
            <button style={S.showPassBtn} onClick={() => setShowPass((p) => !p)} className="show-pass-btn">
              {showPass ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={S.errorBox} role="alert">
          <span style={S.errorIcon}>!</span>
          <span>{error}</span>
        </div>
      )}

      <button
        style={{ ...S.primaryBtn, ...(!canSubmit ? S.primaryBtnOff : {}) }}
        onClick={handleCreate}
        disabled={!canSubmit}
        className="primary-btn"
      >
        {loading
          ? <><span style={S.btnSpinner} className="btn-spin" /> Creating...</>
          : "Create secret link →"}
      </button>

      <p style={S.disclaimer}>
        AES-256 encrypted · Zero logs · We cannot read your notes · Open source
      </p>
    </div>
  );
}

// ── Read View ─────────────────────────────────────────────────────────────────

function ReadView({ noteId }) {
  const [phase,    setPhase]    = useState("loading");
  const [meta,     setMeta]     = useState(null);
  const [password, setPassword] = useState("");
  const [passErr,  setPassErr]  = useState(false);
  const [content,  setContent]  = useState(null);
  const [copied,   setCopied]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errMsg,   setErrMsg]   = useState(null);

  // Step 1: check note exists on mount — does NOT destroy note
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const data = await apiCheckNote(noteId, null);
        if (cancelled) return;
        if (data._status === 404) {
          setPhase("dead");
        } else if (data._status === 401 || data.passwordRequired) {
          setPhase("password");
        } else if (data._status === 200 && data.exists) {
          setMeta(data);
          setPhase("confirm");
        } else {
          setErrMsg(data.error || "Unexpected server response.");
          setPhase("error");
        }
      } catch (err) {
        if (!cancelled) { setErrMsg(err.message); setPhase("error"); }
      }
    }
    check();
    return () => { cancelled = true; };
  }, [noteId]);

  // Password check (still confirm:false — just verifying password, not destroying)
  async function handlePasswordSubmit() {
    if (!password.trim()) return;
    setLoading(true);
    setPassErr(false);
    try {
      const data = await apiCheckNote(noteId, password);
      if (data._status === 401 || data._status === 403) {
        setPassErr(true);
      } else if (data._status === 200 && data.exists) {
        setMeta(data);
        setPhase("confirm");
      } else if (data._status === 404) {
        setPhase("dead");
      } else {
        setErrMsg(data.error || "Unexpected server response.");
        setPhase("error");
      }
    } catch (err) {
      setErrMsg(err.message);
      setPhase("error");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: decrypt + destroy
  async function handleConfirm() {
    setLoading(true);
    try {
      const data = await apiDestroyNote(noteId, password || null);

      if (data._status === 200 && data.content != null) {
        // Content returned — note successfully read and destroyed
        setContent(data.content);
        setPhase("content");
        track("note_read_and_destroyed");
      } else if (data._status === 404) {
        // Note was gone before we could read it (already used or expired)
        setPhase("dead");
      } else {
        // Something went wrong (e.g. decrypt error) — show specific message
        setErrMsg(data.error || "Something went wrong reading the note.");
        setPhase("error");
      }
    } catch (err) {
      setErrMsg(err.message);
      setPhase("error");
    } finally {
      setLoading(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === "loading") return (
    <div style={{ ...S.card, alignItems: "center", gap: "16px" }} className="fade-in">
      <div style={S.loadRing} className="spin" />
      <p style={S.cardSub}>Checking note...</p>
    </div>
  );

  // ── Error (network / server) — separate from "dead" ───────────────────────
  if (phase === "error") return (
    <div style={{ ...S.card, alignItems: "center", textAlign: "center" }} className="fade-in">
      <div style={S.phaseIcon}>⚠️</div>
      <h2 style={S.cardTitle}>Something went wrong.</h2>
      <p style={S.cardSub}>{errMsg}</p>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          style={S.ghostBtn}
          onClick={() => { setErrMsg(null); setPhase("loading"); }}
          className="ghost-btn"
        >
          Try again
        </button>
        <a href="/" style={S.ghostBtn} className="ghost-btn">← Create a note</a>
      </div>
    </div>
  );

  // ── Dead / not found ───────────────────────────────────────────────────────
  if (phase === "dead") return (
    <div style={{ ...S.card, textAlign: "center", alignItems: "center" }} className="fade-in">
      <div style={S.deadIcon}>𝕏</div>
      <h2 style={S.cardTitle}>This note no longer exists.</h2>
      <p style={S.cardSub}>
        It was already read, has expired, or was never created.
        One-time notes vanish after a single view — forever, by design.
      </p>
      <a href="/" style={S.ghostBtn} className="ghost-btn">← Create a new note</a>
    </div>
  );

  // ── Password ───────────────────────────────────────────────────────────────
  if (phase === "password") return (
    <div style={{ ...S.card, textAlign: "center", alignItems: "center" }} className="fade-in">
      <div style={S.phaseIcon}>🔒</div>
      <h2 style={S.cardTitle}>Password required</h2>
      <p style={S.cardSub}>The sender protected this note. Enter the password to continue.</p>
      <div style={{ ...S.passRow, width: "100%" }}>
        <input
          style={{ ...S.passInput, width: "100%", ...(passErr ? S.passInputErr : {}) }}
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setPassErr(false); }}
          onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
          autoFocus
        />
      </div>
      {passErr && (
        <div style={S.errorBox} role="alert">
          <span style={S.errorIcon}>!</span>
          Incorrect password. Try again.
        </div>
      )}
      <button
        style={{ ...S.primaryBtn, ...(!password.trim() || loading ? S.primaryBtnOff : {}), width: "100%" }}
        onClick={handlePasswordSubmit}
        disabled={!password.trim() || loading}
        className="primary-btn"
      >
        {loading ? "Checking..." : "Unlock note →"}
      </button>
    </div>
  );

  // ── Confirm ────────────────────────────────────────────────────────────────
  if (phase === "confirm") return (
    <div style={{ ...S.card, textAlign: "center", alignItems: "center" }} className="fade-in">
      <div style={S.phaseIcon}>🔥</div>
      <h2 style={S.cardTitle}>Ready to read this note?</h2>
      <p style={S.cardSub}>
        This is a <strong>one-time note</strong>. The moment you open it, it is{" "}
        <strong style={{ color: C.amber }}>permanently deleted</strong>. No undo.
      </p>
      {meta?.createdAt && (
        <div style={S.pillRow}>
          <span style={S.pill}>Created {timeAgo(meta.createdAt)}</span>
          {meta.expiresAt && (
            <span style={S.pill}>
              Expires {new Date(meta.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      )}
      <button
        style={{ ...S.burnBtn, ...(loading ? S.primaryBtnOff : {}), width: "100%" }}
        onClick={handleConfirm}
        disabled={loading}
        className="burn-btn"
      >
        {loading ? "Opening..." : "🔥 Read & destroy this note"}
      </button>
      <p style={S.disclaimer}>There is no going back once you click.</p>
    </div>
  );

  // ── Content ────────────────────────────────────────────────────────────────
  if (phase === "content") return (
    <div style={S.card} className="fade-in">
      <div style={S.destroyedBadge}>✓ Note destroyed — this was its only view</div>

      <div style={S.contentBox}>
        <pre style={S.contentPre}>{content}</pre>
      </div>

      <button
        style={{ ...S.amberBtn, ...(copied ? S.amberBtnDone : {}), alignSelf: "flex-start" }}
        onClick={() => {
          navigator.clipboard.writeText(content);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="amber-btn"
      >
        {copied ? "✓ Copied!" : "Copy content"}
      </button>

      <div style={S.warningBox}>
        <span style={S.warningIcon}>⚠</span>
        <span>
          This note is gone from our servers.{" "}
          <strong>Save the content now</strong> — refreshing this page will not bring it back.
        </span>
      </div>

      <a href="/" style={S.ghostBtn} className="ghost-btn">← Create a new note</a>
    </div>
  );

  return null;
}

// ── GitHub icon ───────────────────────────────────────────────────────────────

function GithubIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      style={{ verticalAlign: "middle", marginRight: "5px" }}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const noteId = getNoteIdFromURL();

  useEffect(() => {
    track("page_view", { page: noteId ? "read_note" : "create_note" });
  }, []);

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      <nav style={S.nav}>
        <a href="/" style={S.navLogo}>
          <span style={S.navLogoGlyph}>◈</span>OneTimeNote
        </a>
        <div style={S.navRight}>
          <a href={GITHUB} target="_blank" rel="noreferrer" style={S.navLink} className="nav-link">
            <GithubIcon />mykelayo
          </a>
        </div>
      </nav>

      <main style={S.main}>
        {!noteId && (
          <div style={S.hero}>
            <div style={S.heroBadge}>Free &amp; Open Source</div>
            <h1 style={S.heroTitle}>
              Share secrets.<br />
              <span style={S.heroEmphasis}>Leave no trace.</span>
            </h1>
            <p style={S.heroSub}>
              Write a private, encrypted note. Share the link. It self-destructs
              the moment it's read, and we have no way to recover it.
            </p>
          </div>
        )}
        {noteId ? <ReadView noteId={noteId} /> : <CreateView />}
      </main>

      <footer style={S.footer}>
        <div style={S.footerInner}>
          <span style={S.footerBrand}><span style={{ color: C.amber }}>◈</span> OneTimeNote</span>
          <span style={S.footerMeta}>AES-256 · Zero logs · MIT License</span>
          <a href={GITHUB} target="_blank" rel="noreferrer" style={S.footerLink} className="nav-link">
            <GithubIcon />mykelayo
          </a>
        </div>
      </footer>
    </div>
  );
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:         "#faf5ee",
  bgCard:     "#ffffff",
  bgInput:    "#fdf8f2",
  bgMuted:    "#f5ede0",
  border:     "#e8d5b8",
  text:       "#1a0f00",
  textSub:    "#6b4c2a",
  muted:      "#a07850",
  amber:      "#c87820",
  amberHover: "#a86010",
  amberLight: "#fef4e0",
  green:      "#2d7a4a",
  greenLight: "#edf7f1",
  red:        "#b83225",
  redLight:   "#fdf0ee",
};

const S = {
  root: {
    background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif",
    color: C.text, display: "flex", flexDirection: "column",
    backgroundImage: "radial-gradient(ellipse at 20% 0%, rgba(200,120,32,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(200,120,32,0.04) 0%, transparent 60%)",
  },
  nav: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "0 32px", height: "60px", borderBottom: `1px solid ${C.border}`,
    background: "rgba(250,245,238,0.96)", backdropFilter: "blur(8px)",
    position: "sticky", top: 0, zIndex: 100,
  },
  navLogo: {
    display: "flex", alignItems: "center", gap: "8px", fontSize: "17px",
    fontWeight: "700", color: C.text, textDecoration: "none",
    fontFamily: "'Playfair Display', serif",
  },
  navLogoGlyph: { color: C.amber, fontSize: "18px" },
  navRight: { display: "flex", alignItems: "center", gap: "24px" },
  navLink: {
    display: "flex", alignItems: "center", color: C.muted, textDecoration: "none",
    fontSize: "13px", fontFamily: "'IBM Plex Mono', monospace", transition: "color 0.15s",
  },
  main: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "48px 20px", gap: "40px",
  },
  hero: { textAlign: "center", maxWidth: "540px" },
  heroBadge: {
    display: "inline-block", background: C.amberLight, border: `1px solid ${C.border}`,
    borderRadius: "20px", padding: "5px 16px", fontSize: "11px",
    fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "2px",
    color: C.amber, marginBottom: "28px",
  },
  heroTitle: {
    fontSize: "clamp(36px,7vw,64px)", fontWeight: "700", fontFamily: "'Playfair Display', serif",
    color: C.text, margin: "0 0 18px 0", lineHeight: "1.1", letterSpacing: "-1.5px",
  },
  heroEmphasis: { fontStyle: "italic", color: C.amber },
  heroSub: {
    fontSize: "16px", color: C.textSub, lineHeight: "1.8", margin: 0,
    maxWidth: "420px", marginLeft: "auto", marginRight: "auto",
  },
  card: {
    background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: "16px",
    padding: "clamp(24px,4vw,40px)", width: "100%", maxWidth: "580px",
    display: "flex", flexDirection: "column", gap: "24px",
    boxShadow: "0 2px 8px rgba(26,15,0,0.06), 0 20px 48px rgba(26,15,0,0.08)",
  },
  cardTitle: {
    fontSize: "22px", fontWeight: "700", fontFamily: "'Playfair Display', serif",
    color: C.text, margin: 0,
  },
  cardSub: { fontSize: "14px", color: C.textSub, lineHeight: "1.7", margin: 0 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  textarea: {
    background: C.bgInput, border: `1.5px solid ${C.border}`, borderRadius: "10px",
    padding: "16px", color: C.text, fontSize: "15px", fontFamily: "'DM Sans', sans-serif",
    lineHeight: "1.7", resize: "vertical", outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s", width: "100%", boxSizing: "border-box", minHeight: "160px",
  },
  textareaErr: { borderColor: C.red, background: C.redLight },
  charRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  charNum: { fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", transition: "color 0.2s" },
  charErr: { fontSize: "12px", color: C.red, fontWeight: "500" },
  charWarn: { fontSize: "12px", color: C.amber, fontWeight: "500" },
  optionsGrid: { display: "flex", flexDirection: "column", gap: "20px" },
  optBlock: { display: "flex", flexDirection: "column", gap: "8px" },
  optLabel: { fontSize: "10px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "2px", color: C.muted },
  optHint: { color: C.border },
  segGroup: { display: "flex", gap: "6px", flexWrap: "wrap" },
  seg: {
    background: C.bgMuted, border: `1.5px solid ${C.border}`, color: C.textSub,
    fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", padding: "7px 14px",
    cursor: "pointer", borderRadius: "8px", transition: "all 0.15s",
  },
  segOn: { background: C.amberLight, border: `1.5px solid ${C.amber}`, color: C.amber, fontWeight: "500" },
  passRow: { display: "flex", gap: "8px" },
  passInput: {
    flex: 1, background: C.bgInput, border: `1.5px solid ${C.border}`, borderRadius: "10px",
    padding: "10px 14px", color: C.text, fontSize: "14px", fontFamily: "'DM Sans', sans-serif",
    outline: "none", transition: "border-color 0.2s", boxSizing: "border-box",
  },
  passInputErr: { borderColor: C.red, background: C.redLight },
  showPassBtn: {
    background: C.bgMuted, border: `1.5px solid ${C.border}`, color: C.textSub,
    fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "1px",
    padding: "10px 14px", cursor: "pointer", borderRadius: "8px", flexShrink: 0, transition: "all 0.15s",
  },
  primaryBtn: {
    background: C.amber, color: "#fff", border: "none", padding: "14px 24px",
    fontSize: "15px", fontFamily: "'DM Sans', sans-serif", fontWeight: "600",
    cursor: "pointer", borderRadius: "10px", transition: "all 0.2s",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
  },
  primaryBtnOff: { background: C.border, color: C.muted, cursor: "not-allowed" },
  burnBtn: {
    background: "transparent", color: C.amber, border: `2px solid ${C.amber}`,
    padding: "14px 24px", fontSize: "15px", fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600", cursor: "pointer", borderRadius: "10px", transition: "all 0.2s",
  },
  amberBtn: {
    background: C.amberLight, border: `1.5px solid ${C.border}`, color: C.amber,
    fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", padding: "9px 18px",
    cursor: "pointer", borderRadius: "8px", transition: "all 0.2s", fontWeight: "500",
  },
  amberBtnDone: { background: C.greenLight, borderColor: C.green, color: C.green },
  ghostBtn: {
    background: "transparent", border: `1.5px solid ${C.border}`, color: C.muted,
    fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", padding: "10px 18px",
    cursor: "pointer", borderRadius: "8px", textDecoration: "none",
    textAlign: "center", transition: "all 0.2s", display: "inline-block",
  },
  btnSpinner: {
    display: "inline-block", width: "14px", height: "14px",
    border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%",
  },
  errorBox: {
    background: C.redLight, border: `1px solid #f0c0bb`, borderLeft: `3px solid ${C.red}`,
    borderRadius: "8px", padding: "12px 16px", color: C.red, fontSize: "13px",
    display: "flex", gap: "10px", alignItems: "center", fontWeight: "500",
  },
  errorIcon: {
    border: `1.5px solid ${C.red}`, borderRadius: "50%", width: "18px", height: "18px",
    textAlign: "center", lineHeight: "17px", fontSize: "11px", flexShrink: 0, fontWeight: "700",
  },
  warningBox: {
    background: C.amberLight, border: `1px solid #f0d890`, borderLeft: `3px solid ${C.amber}`,
    borderRadius: "8px", padding: "12px 16px", fontSize: "13px", color: C.textSub,
    display: "flex", gap: "10px", alignItems: "flex-start", lineHeight: "1.6",
  },
  warningIcon: { fontSize: "16px", flexShrink: 0 },
  disclaimer: {
    fontSize: "12px", color: C.muted, lineHeight: "1.7", margin: 0,
    textAlign: "center", fontFamily: "'IBM Plex Mono', monospace",
  },
  successTop: { display: "flex", alignItems: "flex-start", gap: "16px" },
  successRing: {
    width: "44px", height: "44px", borderRadius: "50%", border: `2px solid ${C.green}`,
    background: C.greenLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  successCheck: { color: C.green, fontSize: "18px", fontWeight: "700" },
  linkCard: {
    background: C.bgMuted, border: `1.5px solid ${C.border}`, borderRadius: "10px",
    padding: "18px 20px", display: "flex", flexDirection: "column", gap: "10px",
  },
  linkLabel: { fontSize: "9px", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "3px", color: C.muted },
  linkValue: { fontSize: "13px", fontFamily: "'IBM Plex Mono', monospace", color: C.text, wordBreak: "break-all", lineHeight: "1.5" },
  loadRing: { width: "32px", height: "32px", border: `2px solid ${C.border}`, borderTop: `2px solid ${C.amber}`, borderRadius: "50%" },
  deadIcon: { fontSize: "44px", textAlign: "center", color: C.border, fontFamily: "'Playfair Display', serif" },
  phaseIcon: { fontSize: "44px", textAlign: "center" },
  pillRow: { display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" },
  pill: {
    background: C.bgMuted, border: `1px solid ${C.border}`, borderRadius: "20px",
    padding: "4px 12px", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", color: C.muted,
  },
  destroyedBadge: {
    background: C.greenLight, border: `1px solid #b8dfc8`, borderRadius: "8px",
    padding: "10px 14px", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace",
    color: C.green, textAlign: "center", fontWeight: "500",
  },
  contentBox: {
    background: C.bgInput, border: `1.5px solid ${C.border}`, borderRadius: "10px",
    padding: "20px", maxHeight: "400px", overflowY: "auto",
  },
  contentPre: {
    margin: 0, fontSize: "15px", color: C.text, lineHeight: "1.7",
    whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'DM Sans', sans-serif",
  },
  footer: { padding: "20px 32px", borderTop: `1px solid ${C.border}`, background: C.bgMuted },
  footerInner: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    flexWrap: "wrap", gap: "12px", maxWidth: "1000px", margin: "0 auto",
  },
  footerBrand: { fontSize: "14px", fontWeight: "600", color: C.textSub, fontFamily: "'Playfair Display', serif", display: "flex", alignItems: "center", gap: "6px" },
  footerMeta: { fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", color: C.muted },
  footerLink: { display: "flex", alignItems: "center", color: C.muted, textDecoration: "none", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace", transition: "color 0.15s" },
};

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: ${C.bg}; }
  *:focus-visible { outline: 2px solid ${C.amber}; outline-offset: 2px; border-radius: 4px; }

  .nav-link:hover      { color: ${C.amber} !important; }
  .seg:hover           { border-color: ${C.amber} !important; color: ${C.amber} !important; background: ${C.amberLight} !important; }
  .seg-on              { pointer-events: none; }
  .show-pass-btn:hover { border-color: ${C.amber} !important; color: ${C.amber} !important; }
  .primary-btn:not(:disabled):hover { background: ${C.amberHover} !important; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(200,120,32,0.25); }
  .burn-btn:not(:disabled):hover    { background: ${C.amberLight} !important; }
  .amber-btn:hover  { border-color: ${C.amber} !important; background: #fef0d0 !important; }
  .ghost-btn:hover  { border-color: ${C.amber} !important; color: ${C.amber} !important; }

  .note-textarea:focus { border-color: ${C.amber} !important; box-shadow: 0 0 0 3px rgba(200,120,32,0.12) !important; }
  .note-textarea::placeholder { color: ${C.border}; }
  .pass-input:focus { border-color: ${C.amber} !important; box-shadow: 0 0 0 3px rgba(200,120,32,0.12) !important; }
  .pass-input::placeholder { color: ${C.border}; }

  .spin     { animation: spin 0.8s linear infinite; }
  .btn-spin { animation: spin 0.7s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .fade-in { animation: fadeUp 0.3s cubic-bezier(0.4,0,0.2,1) forwards; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  ::selection { background: rgba(200,120,32,0.18); }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: ${C.bgMuted}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: ${C.amber}; }
`;