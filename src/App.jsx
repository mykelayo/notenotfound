import { useState, useEffect } from "react";

const BASE_URL = "https://onetimenote.netlify.app"; 
const GITHUB   = "https://github.com/mykelayo/onetimenote";
const MAX_CHARS = 10000;

const EXPIRY_OPTIONS = [
  { label: "1 hour",   seconds: 3600 },
  { label: "24 hours", seconds: 86400 },
  { label: "3 days",   seconds: 259200 },
  { label: "7 days",   seconds: 604800 },
];

function getNoteIdFromURL() {
  const match = window.location.pathname.match(/^\/note\/([a-f0-9]{32})$/);
  return match ? match[1] : null;
}

function formatExpiry(seconds) {
  if (seconds <= 3600)   return "1 hour";
  if (seconds <= 86400)  return "24 hours";
  if (seconds <= 259200) return "3 days";
  return "7 days";
}

function timeAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  const hours = Math.floor(mins / 60);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${hours}h ago`;
}

// ─── CREATE VIEW ──────────────────────────────────────────────────────────────

function CreateView() {
  const [content, setContent]   = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [expiry, setExpiry]     = useState(86400);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [copied, setCopied]     = useState(false);
  const [error, setError]       = useState(null);

  const chars     = content.length;
  const overLimit = chars > MAX_CHARS;
  const nearLimit = chars > MAX_CHARS * 0.8;

  async function handleCreate() {
    if (!content.trim() || overLimit) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/create-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, password: password || null, expirySeconds: expiry }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Something went wrong.");
      else setResult(data);
    } catch { setError("Network error. Try again."); }
    setLoading(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(`${BASE_URL}/note/${result.id}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (result) {
    return (
      <div style={S.card} className="fade-in">
        <div style={S.successRing}><span style={S.successCheck}>✓</span></div>
        <div style={S.centerText}>
          <h2 style={S.cardTitle}>Your note is ready.</h2>
          <p style={S.cardSub}>
            Share the link below. It vanishes the moment someone reads it,
            or in <em style={{color:"#e8a030"}}>{formatExpiry(expiry)}</em> if never opened.
          </p>
        </div>
        <div style={S.linkCard}>
          <div style={S.linkLabel}>SECRET LINK</div>
          <div style={S.linkValue}>{BASE_URL}/note/{result.id}</div>
          <button style={{...S.outlineBtn, ...(copied ? S.outlineBtnDone : {})}}
            onClick={copyLink} className="outline-btn">
            {copied ? "✓ Copied!" : "Copy link"}
          </button>
        </div>
        {password && (
          <div style={S.hintBox}>
            <span>🔒</span>
            <span>Remember to share the password separately — never in the same message as the link.</span>
          </div>
        )}
        <button style={S.textBtn} onClick={() => { setResult(null); setContent(""); setPassword(""); }}
          className="text-btn">← Write another note</button>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <div>
        <h2 style={S.cardTitle}>Write your secret note</h2>
        <p style={S.cardSub}>Encrypted end-to-end. Destroyed after one read.</p>
      </div>

      <div style={S.fieldWrap}>
        <textarea
          style={{...S.textarea, ...(overLimit ? S.textareaErr : {})}}
          placeholder="Type anything — passwords, private messages, sensitive info..."
          value={content}
          onChange={e => setContent(e.target.value)}
          className="warm-textarea"
          rows={7}
        />
        <div style={S.charRow}>
          {overLimit && <span style={S.charErr}>Over limit — trim your note</span>}
          {nearLimit && !overLimit && <span style={S.charWarn}>{MAX_CHARS - chars} characters left</span>}
          {!nearLimit && !overLimit && <span />}
          <span style={{...S.charNum, color: overLimit ? "#c0392b" : nearLimit ? "#e8a030" : "#5a4535"}}>
            {chars.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>
      </div>

      <div style={S.optionsGrid}>
        <div style={S.optionBlock}>
          <label style={S.optLabel}>Expires in</label>
          <div style={S.segGroup}>
            {EXPIRY_OPTIONS.map(opt => (
              <button key={opt.seconds}
                style={{...S.seg, ...(expiry === opt.seconds ? S.segOn : {})}}
                className={`seg ${expiry === opt.seconds ? "seg-on" : ""}`}
                onClick={() => setExpiry(opt.seconds)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={S.optionBlock}>
          <label style={S.optLabel}>Password <span style={S.optHint}>(optional)</span></label>
          <div style={S.passWrap}>
            <input
              style={S.passInput}
              type={showPass ? "text" : "password"}
              placeholder="Add a password for extra security"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="warm-input"
            />
            <button style={S.showBtn} onClick={() => setShowPass(p => !p)} className="show-btn">
              {showPass ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>

      {error && <div style={S.errorBox}><span style={S.errorDot}>!</span>{error}</div>}

      <button
        style={{...S.mainBtn, ...((loading || !content.trim() || overLimit) ? S.mainBtnOff : {})}}
        onClick={handleCreate}
        disabled={loading || !content.trim() || overLimit}
        className="main-btn"
      >
        {loading ? "Creating..." : "Create secret link →"}
      </button>

      <p style={S.disclaimer}>
        AES-256 encrypted. We never read your notes. Once read, gone forever.
      </p>
    </div>
  );
}

// ─── READ VIEW ────────────────────────────────────────────────────────────────

function ReadView({ noteId }) {
  const [phase, setPhase]       = useState("loading");
  const [meta, setMeta]         = useState(null);
  const [password, setPassword] = useState("");
  const [passErr, setPassErr]   = useState(false);
  const [content, setContent]   = useState(null);
  const [copied, setCopied]     = useState(false);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`${BASE_URL}/api/read-note`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: noteId, confirm: false }),
        });
        const data = await res.json();
        if (!res.ok || !data.exists) { setPhase("dead"); return; }
        setMeta(data);
        setPhase(data.hasPassword ? "password" : "confirm");
      } catch { setPhase("dead"); }
    }
    check();
  }, [noteId]);

  async function handlePassword() {
    setLoading(true); setPassErr(false);
    try {
      const res = await fetch(`${BASE_URL}/api/read-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noteId, password, confirm: false }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) setPassErr(true);
      else if (data.exists) setPhase("confirm");
      else setPhase("dead");
    } catch { setPhase("dead"); }
    setLoading(false);
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/read-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noteId, password: password || undefined, confirm: true }),
      });
      const data = await res.json();
      if (data.content) { setContent(data.content); setPhase("content"); }
      else setPhase("dead");
    } catch { setPhase("dead"); }
    setLoading(false);
  }

  if (phase === "loading") return (
    <div style={{...S.card, alignItems:"center"}} className="fade-in">
      <div style={S.spinner} className="spin" />
      <p style={S.cardSub}>Checking note...</p>
    </div>
  );

  if (phase === "dead") return (
    <div style={{...S.card, alignItems:"center", textAlign:"center"}} className="fade-in">
      <div style={S.deadGlyph}>𝕏</div>
      <h2 style={S.cardTitle}>This note no longer exists.</h2>
      <p style={S.cardSub}>Already read, expired, or never created.<br />One-time notes vanish after a single view — forever.</p>
      <a href="/" style={S.textBtn} className="text-btn">← Create a new note</a>
    </div>
  );

  if (phase === "password") return (
    <div style={{...S.card, alignItems:"center", textAlign:"center"}} className="fade-in">
      <div style={S.bigGlyph}>🔒</div>
      <h2 style={S.cardTitle}>Password required</h2>
      <p style={S.cardSub}>The sender protected this note with a password.</p>
      <div style={{...S.passWrap, width:"100%"}}>
        <input
          style={{...S.passInput, ...(passErr ? S.passInputErr : {})}}
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={e => { setPassword(e.target.value); setPassErr(false); }}
          onKeyDown={e => e.key === "Enter" && handlePassword()}
          className="warm-input"
          autoFocus
        />
      </div>
      {passErr && <div style={S.errorBox}><span style={S.errorDot}>!</span>Wrong password.</div>}
      <button style={{...S.mainBtn, ...((loading || !password) ? S.mainBtnOff : {}), width:"100%"}}
        onClick={handlePassword} disabled={loading || !password} className="main-btn">
        {loading ? "Checking..." : "Unlock note →"}
      </button>
    </div>
  );

  if (phase === "confirm") return (
    <div style={{...S.card, alignItems:"center", textAlign:"center"}} className="fade-in">
      <div style={S.bigGlyph}>🔥</div>
      <h2 style={S.cardTitle}>Ready to read this note?</h2>
      <p style={S.cardSub}>
        This is a one-time note. The moment you open it,
        it will be <strong style={{color:"#e8a030"}}>permanently deleted</strong> from our servers.
        No undo. No recovery.
      </p>
      {meta?.createdAt && (
        <div style={S.pills}>
          <span style={S.pill}>Created {timeAgo(meta.createdAt)}</span>
          {meta.expiresAt && <span style={S.pill}>Expires {new Date(meta.expiresAt).toLocaleDateString()}</span>}
        </div>
      )}
      <button style={{...S.burnBtn, ...(loading ? S.mainBtnOff : {}), width:"100%"}}
        onClick={handleConfirm} disabled={loading} className="burn-btn">
        {loading ? "Opening..." : "🔥 Read & destroy this note"}
      </button>
      <p style={S.disclaimer}>There is no going back.</p>
    </div>
  );

  if (phase === "content") return (
    <div style={S.card} className="fade-in">
      <div style={S.destroyedBadge}>✓ Note destroyed, this was its only view</div>
      <div style={S.contentScroll}>
        <pre style={S.contentPre}>{content}</pre>
      </div>
      <button style={{...S.outlineBtn, ...(copied ? S.outlineBtnDone : {}), alignSelf:"flex-start"}}
        onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="outline-btn">
        {copied ? "✓ Copied!" : "Copy content"}
      </button>
      <div style={S.hintBox}>
        <span>⚠</span>
        <span>This note is gone from our servers. Save the content now, refreshing will not bring it back.</span>
      </div>
      <a href="/" style={S.textBtn} className="text-btn">← Create a new note</a>
    </div>
  );
}

// ─── GITHUB ICON ─────────────────────────────────────────────────────────────

function GithubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{verticalAlign:"middle", marginRight:"5px"}}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────

export default function App() {
  const noteId = getNoteIdFromURL();

  return (
    <div style={S.root}>
      <style>{css}</style>

      <nav style={S.nav}>
        <a href="/" style={S.navLogo}>
          <span style={S.logoGlyph}>◈</span>
          OneTimeNote
        </a>
        <a href={GITHUB} target="_blank" rel="noreferrer" style={S.navGithub} className="nav-link">
          <GithubIcon />mykelayo
        </a>
      </nav>

      <main style={S.main}>
        {!noteId && (
          <div style={S.hero}>
            <div style={S.heroBadge}>Free & Open Source</div>
            <h1 style={S.heroTitle}>Share secrets.<br />Leave no trace.</h1>
            <p style={S.heroSub}>
              Write a private, encrypted note and share it with exactly one person.
              The link self-destructs the moment it's opened.
            </p>
          </div>
        )}
        {noteId ? <ReadView noteId={noteId} /> : <CreateView />}
      </main>

      <footer style={S.footer}>
        <div style={S.footerRow}>
          <span style={S.footerLogo}><span style={S.logoGlyph}>◈</span> OneTimeNote</span>
          <span style={S.footerMeta}>AES-256 encrypted · Zero logs · MIT License</span>
          <a href={GITHUB} target="_blank" rel="noreferrer" style={S.footerLink} className="nav-link">
            <GithubIcon />mykelayo
          </a>
        </div>
      </footer>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const S = {
  root: { background:"#0e0a04", minHeight:"100vh", fontFamily:"'Lora','Georgia',serif", color:"#c4a882", display:"flex", flexDirection:"column" },

  nav: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 32px", borderBottom:"1px solid #1e1508" },
  navLogo: { display:"flex", alignItems:"center", gap:"10px", fontSize:"18px", fontWeight:"700", color:"#f0d9b5", textDecoration:"none" },
  logoGlyph: { color:"#e8a030" },
  navGithub: { display:"flex", alignItems:"center", color:"#7a5c3a", textDecoration:"none", fontSize:"13px", fontFamily:"'IBM Plex Mono',monospace", transition:"color 0.2s" },

  main: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 20px", gap:"36px" },

  hero: { textAlign:"center", maxWidth:"520px" },
  heroBadge: { display:"inline-block", background:"#1a1005", border:"1px solid #2e1e08", borderRadius:"20px", padding:"5px 16px", fontSize:"11px", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"2px", color:"#e8a030", marginBottom:"24px" },
  heroTitle: { fontSize:"clamp(36px,7vw,62px)", fontWeight:"700", color:"#f0d9b5", margin:"0 0 16px 0", lineHeight:"1.1", letterSpacing:"-1px" },
  heroSub: { fontSize:"15px", color:"#7a5c3a", lineHeight:"1.8", margin:0 },

  card: { background:"#130e06", border:"1px solid #2a1e0a", borderRadius:"14px", padding:"clamp(24px,4vw,40px)", width:"100%", maxWidth:"580px", display:"flex", flexDirection:"column", gap:"22px", boxShadow:"0 24px 64px rgba(0,0,0,0.5)" },
  cardTitle: { fontSize:"22px", fontWeight:"700", color:"#f0d9b5", margin:0, letterSpacing:"-0.3px" },
  cardSub: { fontSize:"14px", color:"#7a5c3a", lineHeight:"1.7", margin:0 },
  centerText: { textAlign:"center" },

  fieldWrap: { display:"flex", flexDirection:"column", gap:"6px" },
  textarea: { background:"#0e0a04", border:"1px solid #2a1e0a", borderRadius:"8px", padding:"16px", color:"#f0d9b5", fontSize:"15px", fontFamily:"'Lora','Georgia',serif", lineHeight:"1.7", resize:"vertical", outline:"none", transition:"border-color 0.2s", caretColor:"#e8a030", width:"100%" },
  textareaErr: { borderColor:"#7a2020" },
  charRow: { display:"flex", justifyContent:"space-between", alignItems:"center" },
  charNum: { fontSize:"12px", fontFamily:"'IBM Plex Mono',monospace", transition:"color 0.2s" },
  charErr: { fontSize:"12px", color:"#c0392b", fontFamily:"'IBM Plex Mono',monospace" },
  charWarn: { fontSize:"12px", color:"#e8a030", fontFamily:"'IBM Plex Mono',monospace" },

  optionsGrid: { display:"flex", flexDirection:"column", gap:"18px" },
  optionBlock: { display:"flex", flexDirection:"column", gap:"8px" },
  optLabel: { fontSize:"11px", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"2px", color:"#5a3e22" },
  optHint: { color:"#3a2810" },
  segGroup: { display:"flex", gap:"4px", flexWrap:"wrap" },
  seg: { background:"#0e0a04", border:"1px solid #2a1e0a", color:"#7a5c3a", fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", padding:"8px 14px", cursor:"pointer", borderRadius:"6px", transition:"all 0.15s" },
  segOn: { background:"#1e1205", border:"1px solid #e8a030", color:"#e8a030" },

  passWrap: { display:"flex", gap:"8px" },
  passInput: { flex:1, background:"#0e0a04", border:"1px solid #2a1e0a", borderRadius:"8px", padding:"10px 14px", color:"#f0d9b5", fontSize:"14px", fontFamily:"'Lora',serif", outline:"none", transition:"border-color 0.2s", caretColor:"#e8a030" },
  passInputErr: { borderColor:"#7a2020" },
  showBtn: { background:"transparent", border:"1px solid #2a1e0a", color:"#5a3e22", fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", letterSpacing:"1px", padding:"10px 12px", cursor:"pointer", borderRadius:"6px", flexShrink:0, transition:"all 0.15s" },

  errorBox: { background:"#140606", border:"1px solid #2a1010", borderLeft:"3px solid #c0392b", borderRadius:"6px", padding:"12px 16px", color:"#c0392b", fontSize:"13px", fontFamily:"'IBM Plex Mono',monospace", display:"flex", gap:"10px", alignItems:"center" },
  errorDot: { border:"1px solid #c0392b", borderRadius:"50%", width:"18px", height:"18px", textAlign:"center", lineHeight:"18px", fontSize:"11px", flexShrink:0 },

  mainBtn: { background:"#e8a030", color:"#0e0a04", border:"none", padding:"14px 24px", fontSize:"15px", fontFamily:"'Lora',serif", fontWeight:"700", cursor:"pointer", borderRadius:"8px", transition:"all 0.2s" },
  mainBtnOff: { background:"#2a1e0a", color:"#5a3e22", cursor:"not-allowed" },
  burnBtn: { background:"transparent", color:"#e8a030", border:"2px solid #e8a030", padding:"14px 24px", fontSize:"15px", fontFamily:"'Lora',serif", fontWeight:"700", cursor:"pointer", borderRadius:"8px", transition:"all 0.2s" },
  outlineBtn: { background:"transparent", border:"1px solid #2a1e0a", color:"#7a5c3a", fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", letterSpacing:"1px", padding:"8px 16px", cursor:"pointer", borderRadius:"6px", transition:"all 0.2s" },
  outlineBtnDone: { borderColor:"#4a7c4e", color:"#4a7c4e" },
  textBtn: { background:"transparent", border:"none", color:"#5a3e22", fontFamily:"'IBM Plex Mono',monospace", fontSize:"12px", letterSpacing:"1px", cursor:"pointer", textDecoration:"none", textAlign:"center", transition:"color 0.2s", padding:"4px 0" },

  disclaimer: { fontSize:"12px", color:"#3a2810", lineHeight:"1.7", margin:0, textAlign:"center", fontFamily:"'IBM Plex Mono',monospace" },

  successRing: { width:"52px", height:"52px", borderRadius:"50%", border:"2px solid #4a7c4e", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto" },
  successCheck: { color:"#4a7c4e", fontSize:"20px" },
  linkCard: { background:"#0e0a04", border:"1px solid #2a1e0a", borderRadius:"8px", padding:"18px 20px", display:"flex", flexDirection:"column", gap:"10px" },
  linkLabel: { fontSize:"9px", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"3px", color:"#5a3e22" },
  linkValue: { fontSize:"13px", fontFamily:"'IBM Plex Mono',monospace", color:"#c4a882", wordBreak:"break-all", lineHeight:"1.5" },
  hintBox: { background:"#0e0a04", border:"1px solid #2a1e0a", borderLeft:"3px solid #e8a030", borderRadius:"6px", padding:"12px 16px", fontSize:"12px", color:"#7a5c3a", fontFamily:"'IBM Plex Mono',monospace", display:"flex", gap:"10px", alignItems:"flex-start", lineHeight:"1.6" },

  spinner: { width:"28px", height:"28px", border:"2px solid #2a1e0a", borderTop:"2px solid #e8a030", borderRadius:"50%", margin:"0 auto" },
  deadGlyph: { fontSize:"40px", color:"#3a2810", textAlign:"center", fontFamily:"'Lora',serif" },
  bigGlyph: { fontSize:"40px", textAlign:"center" },
  pills: { display:"flex", justifyContent:"center", gap:"8px", flexWrap:"wrap" },
  pill: { background:"#1a1005", border:"1px solid #2a1e0a", borderRadius:"20px", padding:"4px 12px", fontSize:"11px", fontFamily:"'IBM Plex Mono',monospace", color:"#5a3e22" },
  destroyedBadge: { background:"#091209", border:"1px solid #1a3020", borderRadius:"6px", padding:"10px 14px", fontSize:"11px", fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"1px", color:"#4a7c4e", textAlign:"center" },
  contentScroll: { background:"#0e0a04", border:"1px solid #2a1e0a", borderRadius:"8px", padding:"20px", maxHeight:"400px", overflowY:"auto" },
  contentPre: { margin:0, fontSize:"15px", color:"#f0d9b5", lineHeight:"1.7", whiteSpace:"pre-wrap", wordBreak:"break-word", fontFamily:"'Lora',serif" },

  footer: { padding:"24px 32px", borderTop:"1px solid #1e1508" },
  footerRow: { display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px", maxWidth:"1000px", margin:"0 auto", width:"100%" },
  footerLogo: { fontSize:"15px", fontWeight:"700", color:"#5a3e22", display:"flex", alignItems:"center", gap:"8px" },
  footerMeta: { fontSize:"11px", fontFamily:"'IBM Plex Mono',monospace", color:"#3a2810" },
  footerLink: { display:"flex", alignItems:"center", color:"#5a3e22", textDecoration:"none", fontSize:"12px", fontFamily:"'IBM Plex Mono',monospace", transition:"color 0.2s" },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;700&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #0e0a04; }

  .warm-textarea:focus { border-color: #3a2810 !important; }
  .warm-textarea::placeholder { color: #2a1e0a; }
  .warm-input:focus { border-color: #3a2810 !important; }
  .warm-input::placeholder { color: #2a1e0a; }

  .seg:hover { border-color: #3a2810 !important; color: #c4a882 !important; }
  .seg-on { pointer-events: none; }
  .show-btn:hover { color: #c4a882 !important; border-color: #3a2810 !important; }

  .main-btn:not(:disabled):hover { background: #d4922a !important; transform: translateY(-1px); }
  .burn-btn:not(:disabled):hover { background: #e8a03012 !important; transform: translateY(-1px); }
  .outline-btn:hover { border-color: #e8a030 !important; color: #e8a030 !important; }
  .text-btn:hover { color: #c4a882 !important; }
  .nav-link:hover { color: #e8a030 !important; }

  .spin { animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .fade-in { animation: fadeUp 0.35s ease forwards; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  ::selection { background: #e8a03025; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #0e0a04; }
  ::-webkit-scrollbar-thumb { background: #2a1e0a; }
`;
