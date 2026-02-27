// src/Nav.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared navigation bar used by App.jsx and Terms.jsx.
// Includes: logo, page links, Google Translate language picker, theme toggle,
// and a mobile hamburger that reveals the links as a dropdown.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import { GITHUB_URL, AUTHOR } from "./config.js";
import { useTheme } from "./theme.js";

// ── Languages ─────────────────────────────────────────────────────────────────
// Add or remove entries freely. "code" must match Google Translate language codes.
// code: "" restores the original English page.

const LANGUAGES = [
  { code: "",      label: "English",    flag: "🇬🇧" },
  { code: "es",    label: "Español",    flag: "🇪🇸" },
  { code: "fr",    label: "Français",   flag: "🇫🇷" },
  { code: "de",    label: "Deutsch",    flag: "🇩🇪" },
  { code: "pt",    label: "Português",  flag: "🇧🇷" },
  { code: "it",    label: "Italiano",   flag: "🇮🇹" },
  { code: "nl",    label: "Nederlands", flag: "🇳🇱" },
  { code: "ru",    label: "Русский",    flag: "🇷🇺" },
  { code: "zh-CN", label: "中文",       flag: "🇨🇳" },
  { code: "ja",    label: "日本語",     flag: "🇯🇵" },
  { code: "ko",    label: "한국어",     flag: "🇰🇷" },
  { code: "ar",    label: "العربية",    flag: "🇸🇦" },
  { code: "hi",    label: "हिन्दी",     flag: "🇮🇳" },
  { code: "tr",    label: "Türkçe",     flag: "🇹🇷" },
  { code: "pl",    label: "Polski",     flag: "🇵🇱" },
];

// ── Language Picker ───────────────────────────────────────────────────────────

function LangPicker({ C }) {
  const [open,       setOpen]       = useState(false);
  const [activeLang, setActiveLang] = useState("");
  const [ready,      setReady]      = useState(false);
  const ref = useRef(null);

  // Poll until Google Translate injects its hidden select into the DOM
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.querySelector(".goog-te-combo")) {
        setReady(true);
        clearInterval(interval);
      }
    }, 300);
    const timeout = setTimeout(() => clearInterval(interval), 15000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function selectLang(code) {
    const select = document.querySelector(".goog-te-combo");
    if (!select) return;
    select.value = code;
    select.dispatchEvent(new Event("change"));
    setActiveLang(code);
    setOpen(false);
  }

  if (!ready) return null;
  const current = LANGUAGES.find(l => l.code === activeLang) || LANGUAGES[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Translate page"
        aria-label="Select language"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: "5px",
          background: "transparent",
          border: `1px solid ${open ? C.amber : C.border}`,
          borderRadius: "8px", padding: "5px 9px",
          cursor: "pointer", color: open ? C.amber : C.muted,
          fontSize: "13px", fontFamily: "'IBM Plex Mono', monospace",
          transition: "all 0.2s", lineHeight: 1,
        }}
        className="nnf-lang-btn"
      >
        <span style={{ fontSize: "14px" }}>🌐</span>
        <span style={{ fontSize: "11px" }}>{current.flag}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          background: C.bgCard, border: `1px solid ${C.border}`,
          borderRadius: "10px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          zIndex: 200, minWidth: "170px", overflow: "hidden",
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          <div style={{
            padding: "8px 14px", fontSize: "9px", letterSpacing: "2.5px",
            color: C.muted, borderBottom: `1px solid ${C.border}`,
            textTransform: "uppercase",
          }}>
            Language
          </div>
          <div style={{ maxHeight: "260px", overflowY: "auto" }}>
            {LANGUAGES.map(lang => {
              const active = lang.code === activeLang;
              return (
                <button
                  key={lang.code || "en"}
                  onClick={() => selectLang(lang.code)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    width: "100%", background: active ? C.amberLight : "transparent",
                    border: "none", borderBottom: `1px solid ${C.border}`,
                    padding: "9px 14px", cursor: "pointer",
                    textAlign: "left", fontFamily: "inherit", transition: "background 0.15s",
                  }}
                  className="nnf-lang-opt"
                >
                  <span style={{ fontSize: "15px", flexShrink: 0 }}>{lang.flag}</span>
                  <span style={{ fontSize: "12px", color: active ? C.amber : C.textSub, fontWeight: active ? "700" : "400" }}>
                    {lang.label}
                  </span>
                  {active && <span style={{ marginLeft: "auto", color: C.amber, fontSize: "11px" }}>✓</span>}
                </button>
              );
            })}
          </div>
          <div style={{
            padding: "6px 14px", fontSize: "9px", color: C.muted,
            borderTop: `1px solid ${C.border}`, lineHeight: "1.5",
          }}>
            Powered by Google Translate
          </div>
        </div>
      )}
    </div>
  );
}

// ── GitHub Icon ───────────────────────────────────────────────────────────────

export function GithubIcon({ size = 15, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      style={{ verticalAlign: "middle", marginRight: "5px", ...style }}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────

export default function Nav({ links = [] }) {
  const { C, isDark, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 clamp(16px,4vw,32px)", height: "60px",
        borderBottom: `1px solid ${C.border}`,
        background: C.navBg, backdropFilter: "blur(8px)",
        position: "sticky", top: 0, zIndex: 100,
        transition: "background 0.2s, border-color 0.2s",
      }}>
        {/* Logo */}
        <a href="/" style={{
          display: "flex", alignItems: "center", gap: "6px",
          fontSize: "17px", fontWeight: "700", color: C.text,
          textDecoration: "none", fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: "-0.5px", transition: "color 0.2s",
        }}>
          <span style={{ color: C.amber, fontSize: "20px", fontFamily: "monospace" }}>¬</span>
          notenotfound
        </a>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Desktop links */}
          {links.map(l => (
            <a key={l.href} href={l.href} style={{
              color: C.muted, textDecoration: "none", fontSize: "13px",
              fontFamily: "'IBM Plex Mono', monospace", transition: "color 0.15s",
              display: "flex", alignItems: "center",
            }} className="nnf-nav-link">{l.label}</a>
          ))}

          {/* GitHub */}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer"
            style={{
              display: "flex", alignItems: "center", color: C.muted,
              textDecoration: "none", fontSize: "13px",
              fontFamily: "'IBM Plex Mono', monospace", transition: "color 0.15s",
            }}
            className="nnf-nav-link">
            <GithubIcon />{AUTHOR}
          </a>

          {/* Language picker */}
          <LangPicker C={C} />

          {/* Theme toggle */}
          <button
            onClick={toggle}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              background: C.toggleBg, border: `1px solid ${C.border}`,
              borderRadius: "8px", padding: "5px 9px", cursor: "pointer",
              fontSize: "13px", lineHeight: 1, transition: "all 0.2s",
              color: C.text,
            }}
            className="nnf-toggle"
          >
            {C.toggleIcon}
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Menu"
            style={{
              display: "none", background: "transparent",
              border: `1px solid ${C.border}`, color: C.muted,
              fontSize: "15px", padding: "4px 10px", cursor: "pointer",
              borderRadius: "6px", fontFamily: "inherit",
              transition: "all 0.2s",
            }}
            className="nnf-hamburger"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div style={{
          position: "fixed", top: "60px", left: 0, right: 0,
          background: C.navBg, borderBottom: `1px solid ${C.border}`,
          backdropFilter: "blur(12px)", zIndex: 99,
          padding: "8px 20px 16px",
          display: "flex", flexDirection: "column", gap: "2px",
        }}>
          {links.map(l => (
            <a key={l.href} href={l.href}
              onClick={() => setMobileOpen(false)}
              style={{
                color: C.textSub, textDecoration: "none",
                padding: "11px 8px", fontSize: "14px",
                fontFamily: "'IBM Plex Mono', monospace",
                borderBottom: `1px solid ${C.border}`,
                transition: "color 0.15s",
              }}
              className="nnf-nav-link"
            >{l.label}</a>
          ))}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer"
            style={{
              display: "flex", alignItems: "center", color: C.textSub,
              textDecoration: "none", padding: "11px 8px", fontSize: "14px",
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            <GithubIcon />{AUTHOR} ↗
          </a>
        </div>
      )}
    </>
  );
}

// ── Shared global CSS (inject once per page) ──────────────────────────────────
// Import and call: <style>{navCSS(C)}</style>

export function navCSS(C) {
  return `
    .nnf-nav-link:hover  { color: ${C.amber} !important; }
    .nnf-toggle:hover    { border-color: ${C.amber} !important; }
    .nnf-lang-btn:hover  { border-color: ${C.amber} !important; color: ${C.amber} !important; }
    .nnf-lang-opt:hover  { background: ${C.amberLight} !important; }
    .nnf-hamburger:hover { border-color: ${C.amber} !important; color: ${C.amber} !important; }

    @media (max-width: 600px) {
      .nnf-hamburger { display: block !important; }
      .nnf-nav-link  { display: none !important; }
    }
  `;
}
