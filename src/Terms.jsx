// src/Terms.jsx
import { useEffect } from "react";

const GITHUB = "https://github.com/mykelayo/notenotfound";

function GithubIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      style={{ verticalAlign: "middle", marginRight: "5px" }}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

const C = {
  bg:         "#faf5ee",
  bgCard:     "#ffffff",
  bgMuted:    "#f5ede0",
  border:     "#e8d5b8",
  text:       "#1a0f00",
  textSub:    "#6b4c2a",
  muted:      "#a07850",
  amber:      "#c87820",
  amberLight: "#fef4e0",
};

export default function Terms() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* Nav */}
      <nav style={S.nav}>
        <a href="/" style={S.navLogo}>
          <span style={{ color: C.amber, fontFamily: "monospace", fontSize: "18px" }}>¬</span>
          notenotfound
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <a href="/" style={S.navLink} className="nav-link">← Back</a>
          <a href={GITHUB} target="_blank" rel="noreferrer" style={S.navLink} className="nav-link">
            <GithubIcon />mykelayo
          </a>
        </div>
      </nav>

      {/* Content */}
      <main style={S.main}>
        <div style={S.doc}>

          {/* Header */}
          <div style={S.docHeader}>
            <div style={S.badge}>Legal</div>
            <h1 style={S.h1}>Privacy Policy & Terms of Service</h1>
            <p style={S.meta}>
              Effective: February 23, 2026 &nbsp;·&nbsp; Service: notenotfound.netlify.app &nbsp;·&nbsp; Operator: mykelayo
            </p>
          </div>

          <hr style={S.rule} />

          {/* ── Privacy Policy ── */}
          <section>
            <h2 style={S.h2}>Privacy Policy</h2>

            <h3 style={S.h3}>1. What we collect</h3>
            <p style={S.p}>We collect almost nothing.</p>

            <div style={S.table}>
              <div style={S.tableRow}>
                <span style={S.tableHead}>Data</span>
                <span style={S.tableHead}>Collected?</span>
                <span style={{ ...S.tableHead, flex: 2 }}>Details</span>
              </div>
              {[
                ["Note content", "No", "Encrypted with AES-256-GCM before storage. We cannot read it."],
                ["Your identity", "No", "No account, no sign-up, no name, no email."],
                ["IP address", "No", "We do not log your IP address."],
                ["Usage analytics", "Optional", "Google Analytics may collect anonymous page view data if enabled. See section 3."],
                ["Cookies", "Minimal", "Google Analytics or ad providers may set cookies if those services are active."],
              ].map(([d, c, det]) => (
                <div key={d} style={S.tableRow}>
                  <span style={S.tableCell}>{d}</span>
                  <span style={{ ...S.tableCell, color: c === "No" ? C.amber : C.textSub, fontWeight: "500" }}>{c}</span>
                  <span style={{ ...S.tableCell, flex: 2, color: C.textSub }}>{det}</span>
                </div>
              ))}
            </div>

            <h3 style={S.h3}>2. How notes are stored and deleted</h3>
            <ul style={S.ul}>
              <li>Notes are encrypted with <strong>AES-256-GCM</strong> before being written to the database. The encryption key is a server-side environment variable. We have no mechanism to decrypt your notes.</li>
              <li>Notes are stored in <strong>Upstash Redis</strong> with a time-to-live (TTL) enforced at the database level.</li>
              <li>When a note is read, it is <strong>immediately and permanently deleted</strong> from the database before the response is returned.</li>
              <li>If a note is never read, it is <strong>automatically deleted</strong> when its TTL expires (1 hour, 24 hours, 3 days, or 7 days — your choice).</li>
              <li>We have <strong>no recovery mechanism</strong>. A deleted note is gone.</li>
            </ul>

            <h3 style={S.h3}>3. Advertising and analytics</h3>
            <p style={S.p}>notenotfound may display advertising to support the free service.</p>
            <ul style={S.ul}>
              <li><strong>Note content is never used for ad targeting.</strong> We cannot read your notes. Advertisers have zero access to note content.</li>
              <li>If third-party advertising (such as Google AdSense) is active, the advertising provider may use cookies and your IP address to serve contextual or interest-based ads. This is governed by the advertising provider's own privacy policy.</li>
              <li>If Google Analytics is active, anonymous usage data (page views, session counts, general geography) is collected. We do not send personally identifying information to analytics providers.</li>
              <li>You can opt out of Google's advertising tracking via <a href="https://adssettings.google.com" target="_blank" rel="noreferrer" style={S.link}>Google's ad settings</a> or a browser extension like uBlock Origin.</li>
              <li>All note functionality works identically whether or not you accept cookies.</li>
            </ul>

            <div style={S.infoBox}>
              <strong>Advertising provider policies:</strong>
              <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={S.link}>Google AdSense — policies.google.com/privacy</a>
                <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={S.link}>Google Analytics — policies.google.com/privacy</a>
              </div>
            </div>

            <h3 style={S.h3}>4. Third-party services</h3>
            <div style={S.table}>
              <div style={S.tableRow}>
                <span style={S.tableHead}>Service</span>
                <span style={{ ...S.tableHead, flex: 2 }}>Purpose</span>
                <span style={{ ...S.tableHead, flex: 2 }}>Data shared</span>
              </div>
              {[
                ["Netlify", "Hosting and serverless functions", "Standard server logs per Netlify's policy"],
                ["Upstash Redis", "Encrypted note storage", "Encrypted ciphertext and TTL only"],
                ["Google Analytics", "Anonymous usage metrics (optional)", "Page views, sessions — no content"],
                ["Google AdSense", "Advertising (if enabled)", "Cookie, IP — governed by Google policy"],
              ].map(([s, p, d]) => (
                <div key={s} style={S.tableRow}>
                  <span style={S.tableCell}>{s}</span>
                  <span style={{ ...S.tableCell, flex: 2, color: C.textSub }}>{p}</span>
                  <span style={{ ...S.tableCell, flex: 2, color: C.textSub }}>{d}</span>
                </div>
              ))}
            </div>

            <h3 style={S.h3}>5. Children</h3>
            <p style={S.p}>This service is not directed at children under 13. We do not knowingly collect information from children.</p>

            <h3 style={S.h3}>6. Changes to this policy</h3>
            <p style={S.p}>We will update this page when the policy changes. The effective date at the top reflects the most recent revision.</p>

            <h3 style={S.h3}>7. Contact</h3>
            <p style={S.p}>Questions about your data: <a href={GITHUB} target="_blank" rel="noreferrer" style={S.link}>github.com/mykelayo/notenotfound</a> (open an issue).</p>
          </section>

          <hr style={S.rule} />

          {/* ── Terms of Service ── */}
          <section>
            <h2 style={S.h2}>Terms of Service</h2>

            <h3 style={S.h3}>1. Acceptance</h3>
            <p style={S.p}>By using notenotfound ("the Service"), you agree to these Terms. If you do not agree, do not use the Service.</p>

            <h3 style={S.h3}>2. Acceptable use</h3>
            <p style={S.p}>You may use this Service for lawful purposes only. You may not use the Service to:</p>
            <ul style={S.ul}>
              <li>Share or distribute illegal content of any kind</li>
              <li>Threaten, harass, or harm any individual</li>
              <li>Distribute malware, exploits, or code designed to cause harm</li>
              <li>Circumvent legal investigations or obstruct justice</li>
              <li>Violate any applicable local, national, or international law</li>
            </ul>
            <p style={S.p}>We reserve the right to disable the Service if we reasonably believe it is being used to facilitate illegal activity.</p>

            <h3 style={S.h3}>3. Advertising</h3>
            <p style={S.p}>The Service may display advertising to support its free operation. By using the Service, you agree that:</p>
            <ul style={S.ul}>
              <li>Advertising may be served by third-party providers including Google AdSense</li>
              <li>Advertising providers may use cookies to serve relevant ads</li>
              <li><strong>Note content is never shared with advertisers</strong></li>
              <li>You can opt out of personalized advertising via your browser settings or provider opt-out pages</li>
            </ul>

            <h3 style={S.h3}>4. No warranty</h3>
            <p style={S.p}>The Service is provided <strong>"as is"</strong> without warranty of any kind. We do not warrant:</p>
            <ul style={S.ul}>
              <li>That the Service will be available at all times</li>
              <li>That notes will be delivered or received</li>
              <li>That the encryption is free from unknown vulnerabilities</li>
              <li>That third-party services (Upstash, Netlify) will not experience data loss</li>
            </ul>

            <div style={S.warningBox}>
              <strong>Use this Service as a convenience, not your only security layer.</strong> For high-stakes secrets, use a dedicated secrets manager (HashiCorp Vault, AWS Secrets Manager, 1Password Secrets Automation).
            </div>

            <h3 style={S.h3}>5. Limitation of liability</h3>
            <p style={S.p}>To the fullest extent permitted by applicable law, the operator shall not be liable for:</p>
            <ul style={S.ul}>
              <li>Loss of data including unread notes due to TTL expiry or outages</li>
              <li>Unauthorized access to notes through compromise of the encryption key</li>
              <li>Indirect, incidental, or consequential damages from use of the Service</li>
              <li>Damages arising from third-party services (Netlify, Upstash, Google)</li>
            </ul>
            <p style={S.p}><strong>By creating or reading a note, you accept full responsibility for the content you share and the consequences of that content being disclosed.</strong></p>

            <h3 style={S.h3}>6. Open source</h3>
            <p style={S.p}>The Service's source code is published under the MIT License at <a href={GITHUB} target="_blank" rel="noreferrer" style={S.link}>github.com/mykelayo/notenotfound</a>. The MIT License applies to the code — not to these Terms.</p>

            <h3 style={S.h3}>7. Modifications</h3>
            <p style={S.p}>We may update these Terms at any time. Continued use of the Service after an update constitutes acceptance of the revised Terms.</p>

            <h3 style={S.h3}>8. Contact</h3>
            <p style={S.p}>Questions: <a href={GITHUB} target="_blank" rel="noreferrer" style={S.link}>github.com/mykelayo/notenotfound</a></p>
          </section>

          <hr style={S.rule} />
          <p style={{ ...S.meta, marginTop: 0 }}>
            notenotfound is an open-source project operated by an individual developer, not a registered company.
          </p>

        </div>
      </main>

      {/* Footer */}
      <footer style={S.footer}>
        <div style={S.footerInner}>
          <span style={{ fontSize: "14px", fontWeight: "700", color: C.textSub, fontFamily: "'IBM Plex Mono', monospace" }}>
            <span style={{ color: C.amber }}>¬</span> notenotfound
          </span>
          <span style={{ fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", color: C.muted }}>
            AES-256-GCM · Zero logs · MIT License
          </span>
          <a href={GITHUB} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", color: C.muted, textDecoration: "none", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace" }}
            className="nav-link">
            <GithubIcon />mykelayo
          </a>
        </div>
      </footer>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root: {
    background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif",
    color: C.text, display: "flex", flexDirection: "column",
  },
  nav: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "0 32px", height: "60px", borderBottom: `1px solid ${C.border}`,
    background: "rgba(250,245,238,0.96)", backdropFilter: "blur(8px)",
    position: "sticky", top: 0, zIndex: 100,
  },
  navLogo: {
    display: "flex", alignItems: "center", gap: "6px", fontSize: "17px",
    fontWeight: "700", color: C.text, textDecoration: "none",
    fontFamily: "'IBM Plex Mono', monospace",
  },
  navLink: {
    color: C.muted, textDecoration: "none", fontSize: "13px",
    fontFamily: "'IBM Plex Mono', monospace", transition: "color 0.15s",
    display: "flex", alignItems: "center",
  },
  main: {
    flex: 1, display: "flex", justifyContent: "center",
    padding: "48px 20px 64px",
  },
  doc: {
    width: "100%", maxWidth: "720px",
    display: "flex", flexDirection: "column", gap: "28px",
  },
  docHeader: { display: "flex", flexDirection: "column", gap: "12px" },
  badge: {
    display: "inline-block", alignSelf: "flex-start",
    background: C.amberLight, border: `1px solid ${C.border}`,
    borderRadius: "20px", padding: "4px 14px", fontSize: "10px",
    fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "2px", color: C.amber,
  },
  h1: {
    fontSize: "clamp(28px,5vw,42px)", fontWeight: "700",
    fontFamily: "'Playfair Display', serif", color: C.text,
    margin: 0, lineHeight: "1.2", letterSpacing: "-1px",
  },
  h2: {
    fontSize: "22px", fontWeight: "700", fontFamily: "'Playfair Display', serif",
    color: C.text, margin: "0 0 20px 0",
  },
  h3: {
    fontSize: "13px", fontWeight: "600", fontFamily: "'IBM Plex Mono', monospace",
    color: C.amber, letterSpacing: "1px", margin: "28px 0 10px 0",
    textTransform: "uppercase",
  },
  meta: {
    fontSize: "12px", color: C.muted, fontFamily: "'IBM Plex Mono', monospace",
    lineHeight: "1.8", margin: 0,
  },
  p: { fontSize: "15px", color: C.textSub, lineHeight: "1.85", margin: "0 0 12px 0" },
  ul: {
    fontSize: "15px", color: C.textSub, lineHeight: "1.85",
    margin: "0 0 16px 0", paddingLeft: "20px", display: "flex",
    flexDirection: "column", gap: "6px",
  },
  rule: { border: "none", borderTop: `1px solid ${C.border}`, margin: "8px 0" },
  link: { color: C.amber, textDecoration: "underline", textUnderlineOffset: "3px" },
  table: {
    border: `1px solid ${C.border}`, borderRadius: "10px",
    overflow: "hidden", marginBottom: "16px",
  },
  tableRow: {
    display: "flex", borderBottom: `1px solid ${C.border}`,
    "&:last-child": { borderBottom: "none" },
  },
  tableHead: {
    flex: 1, padding: "9px 14px", fontSize: "10px",
    fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "1.5px",
    color: C.muted, background: C.bgMuted, fontWeight: "600",
    textTransform: "uppercase",
  },
  tableCell: {
    flex: 1, padding: "10px 14px", fontSize: "13px",
    color: C.text, borderRight: `1px solid ${C.border}`,
    lineHeight: "1.6",
  },
  infoBox: {
    background: C.amberLight, border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${C.amber}`, borderRadius: "8px",
    padding: "14px 16px", fontSize: "13px", color: C.textSub,
    marginBottom: "16px", lineHeight: "1.7",
  },
  warningBox: {
    background: "#fdf8f0", border: `1px solid #f0d890`,
    borderLeft: `3px solid ${C.amber}`, borderRadius: "8px",
    padding: "14px 16px", fontSize: "14px", color: C.textSub,
    marginBottom: "16px", lineHeight: "1.7",
  },
  footer: {
    padding: "20px 32px", borderTop: `1px solid ${C.border}`, background: C.bgMuted,
  },
  footerInner: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    flexWrap: "wrap", gap: "12px", maxWidth: "1000px", margin: "0 auto",
  },
};

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: ${C.bg}; }
  .nav-link:hover { color: ${C.amber} !important; }
  ul li::marker { color: ${C.amber}; }
`;