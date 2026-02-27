// src/Terms.jsx
import { useEffect } from "react";
import { GITHUB_URL, SITE_URL, AUTHOR } from "./config.js";
import { useTheme } from "./theme.js";
import Nav, { navCSS } from "./Nav.jsx";

export default function Terms() {
  const { C } = useTheme();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const siteHost = SITE_URL.replace("https://", "");
  const S = makeStyles(C);

  return (
    <div style={S.root}>
      <style>{globalCSS(C) + navCSS(C)}</style>

      <Nav links={[{ href: "/", label: "← Back" }]} />

      <main style={S.main}>
        <div style={S.doc}>

          <div style={S.docHeader}>
            <div style={S.badge}>Legal</div>
            <h1 style={S.h1}>Privacy Policy &amp; Terms of Service</h1>
            <p style={S.meta}>
              Effective: February 23, 2026 &nbsp;·&nbsp; Service: {siteHost} &nbsp;·&nbsp; Operator: {AUTHOR}
            </p>
          </div>

          <hr style={S.rule} />

          {/* ── Privacy Policy ── */}
          <section>
            <h2 style={S.h2}>Privacy Policy</h2>

            <h3 style={S.h3}>1. What we collect</h3>
            <p style={S.p}>We collect almost nothing.</p>

            <div style={S.tableWrap}>
              <div style={S.table}>
                <div style={{ ...S.tableRow, background: C.bgMuted }}>
                  <span style={{ ...S.tableHead, flex: 1 }}>Data</span>
                  <span style={{ ...S.tableHead, flex: 1 }}>Collected?</span>
                  <span style={{ ...S.tableHead, flex: 2, borderRight: "none" }}>Details</span>
                </div>
                {[
                  ["Note content",    "No",       "Encrypted with AES-256-GCM before storage. We cannot read it."],
                  ["Your identity",   "No",       "No account, no sign-up, no name, no email."],
                  ["IP address",      "No",       "We do not log your IP address."],
                  ["Usage analytics", "Optional", "Google Analytics may collect anonymous page view data if enabled."],
                  ["Cookies",         "Minimal",  "Google Analytics or ad providers may set cookies if those services are active."],
                ].map(([d, c, det], i, arr) => (
                  <div key={d} style={{
                    ...S.tableRow,
                    borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                  }}>
                    <span style={{ ...S.tableCell, flex: 1 }}>{d}</span>
                    <span style={{ ...S.tableCell, flex: 1, color: c === "No" ? C.amber : C.textSub, fontWeight: "600" }}>{c}</span>
                    <span style={{ ...S.tableCell, flex: 2, color: C.textSub, borderRight: "none" }}>{det}</span>
                  </div>
                ))}
              </div>
            </div>

            <h3 style={S.h3}>2. How notes are stored and deleted</h3>
            <ul style={S.ul}>
              <li>Notes are encrypted with <strong>AES-256-GCM</strong> before being written to the database. The encryption key is a server-side environment variable. We have no mechanism to decrypt your notes.</li>
              <li>Notes are stored in <strong>Upstash Redis</strong> with a time-to-live (TTL) enforced at the database level.</li>
              <li>When a note is read, it is <strong>immediately and permanently deleted</strong> from the database before the response is returned.</li>
              <li>If a note is never read, it is <strong>automatically deleted</strong> when its TTL expires (1 hour, 24 hours, 3 days, or 7 days, your choice).</li>
              <li>We have <strong>no recovery mechanism</strong>. A deleted note is gone.</li>
            </ul>

            <h3 style={S.h3}>3. Advertising and analytics</h3>
            <p style={S.p}>notenotfound may display advertising to support the free service.</p>
            <ul style={S.ul}>
              <li><strong>Note content is never used for ad targeting.</strong> We cannot read your notes. Advertisers have zero access to note content.</li>
              <li>If third-party advertising (such as Google AdSense) is active, the advertising provider may use cookies and your IP address to serve contextual or interest-based ads, governed by their own privacy policy.</li>
              <li>If Google Analytics is active, anonymous usage data is collected. No personally identifying information is sent to analytics providers.</li>
              <li>You can opt out via <a href="https://adssettings.google.com" target="_blank" rel="noreferrer" style={S.link}>Google's ad settings</a> or a browser extension like uBlock Origin.</li>
              <li>All note functionality works identically whether or not you accept cookies.</li>
            </ul>

            <div style={S.infoBox}>
              <strong>Advertising provider policies:</strong>
              <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={S.link}>Google AdSense and Analytics: policies.google.com/privacy</a>
              </div>
            </div>

            <h3 style={S.h3}>4. Third-party services</h3>
            <div style={S.tableWrap}>
              <div style={S.table}>
                <div style={{ ...S.tableRow, background: C.bgMuted }}>
                  <span style={{ ...S.tableHead, flex: 1 }}>Service</span>
                  <span style={{ ...S.tableHead, flex: 2 }}>Purpose</span>
                  <span style={{ ...S.tableHead, flex: 2, borderRight: "none" }}>Data shared</span>
                </div>
                {[
                  ["Netlify",          "Hosting and serverless functions",   "Standard server logs per Netlify's policy"],
                  ["Upstash Redis",    "Encrypted note storage",             "Encrypted ciphertext and TTL only"],
                  ["Google Analytics", "Anonymous usage metrics (optional)", "Page views, sessions, no content"],
                  ["Google AdSense",   "Advertising (if enabled)",           "Cookie and IP, governed by Google policy"],
                ].map(([svc, purpose, data], i, arr) => (
                  <div key={svc} style={{
                    ...S.tableRow,
                    borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none",
                  }}>
                    <span style={{ ...S.tableCell, flex: 1 }}>{svc}</span>
                    <span style={{ ...S.tableCell, flex: 2, color: C.textSub }}>{purpose}</span>
                    <span style={{ ...S.tableCell, flex: 2, color: C.textSub, borderRight: "none" }}>{data}</span>
                  </div>
                ))}
              </div>
            </div>

            <h3 style={S.h3}>5. Children</h3>
            <p style={S.p}>This service is not directed at children under 13. We do not knowingly collect information from children.</p>

            <h3 style={S.h3}>6. Changes to this policy</h3>
            <p style={S.p}>We will update this page when the policy changes. The effective date at the top reflects the most recent revision.</p>

            <h3 style={S.h3}>7. Contact</h3>
            <p style={S.p}>Questions about your data: <a href={GITHUB_URL} target="_blank" rel="noreferrer" style={S.link}>{GITHUB_URL.replace("https://", "")}</a> (open an issue).</p>
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

            <h3 style={S.h3}>3. Advertising</h3>
            <ul style={S.ul}>
              <li>Advertising may be served by third-party providers including Google AdSense</li>
              <li>Advertising providers may use cookies to serve relevant ads</li>
              <li><strong>Note content is never shared with advertisers</strong></li>
              <li>You can opt out of personalized advertising via your browser settings</li>
            </ul>

            <h3 style={S.h3}>4. No warranty</h3>
            <div style={S.warningBox}>
              <strong>Use this Service as a convenience, not your only security layer.</strong> For high-stakes secrets, use a dedicated secrets manager (HashiCorp Vault, AWS Secrets Manager, 1Password Secrets Automation).
            </div>
            <p style={S.p}>The Service is provided <strong>"as is"</strong> without warranty of any kind, with no guarantee of availability, delivery, or freedom from vulnerabilities.</p>

            <h3 style={S.h3}>5. Limitation of liability</h3>
            <p style={S.p}>To the fullest extent permitted by applicable law, the operator shall not be liable for loss of data, unauthorized access, or damages arising from use of the Service or its third-party dependencies.</p>

            <h3 style={S.h3}>6. Open source</h3>
            <p style={S.p}>Source code is MIT licensed at <a href={GITHUB_URL} target="_blank" rel="noreferrer" style={S.link}>{GITHUB_URL.replace("https://", "")}</a>. The MIT License applies to the code, not to these Terms.</p>

            <h3 style={S.h3}>7. Modifications</h3>
            <p style={S.p}>We may update these Terms at any time. Continued use constitutes acceptance of the revised Terms.</p>

            <h3 style={S.h3}>8. Contact</h3>
            <p style={S.p}><a href={GITHUB_URL} target="_blank" rel="noreferrer" style={S.link}>{GITHUB_URL.replace("https://", "")}</a></p>
          </section>

          <hr style={S.rule} />
          <p style={{ ...S.meta, marginTop: 0 }}>
            notenotfound is an open-source project operated by an individual developer, not a registered company.
          </p>

        </div>
      </main>

      <footer style={S.footer}>
        <div style={S.footerInner}>
          <span style={{ fontSize: "14px", fontWeight: "700", color: C.textSub, fontFamily: "'IBM Plex Mono', monospace" }}>
            <span style={{ color: C.amber }}>¬</span> notenotfound
          </span>
          <span style={{ fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", color: C.muted }}>
            AES-256-GCM. Zero logs. MIT License.
          </span>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", color: C.muted, textDecoration: "none", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace" }}
            className="nnf-nav-link">
            {AUTHOR} ↗
          </a>
        </div>
      </footer>
    </div>
  );
}

function makeStyles(C) {
  return {
    root: {
      background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif",
      color: C.text, display: "flex", flexDirection: "column", transition: "background 0.2s, color 0.2s",
    },
    main: { flex: 1, display: "flex", justifyContent: "center", padding: "48px clamp(16px,4vw,20px) 64px" },
    doc:  { width: "100%", maxWidth: "720px", display: "flex", flexDirection: "column", gap: "28px" },
    docHeader: { display: "flex", flexDirection: "column", gap: "12px" },
    badge: {
      display: "inline-block", alignSelf: "flex-start",
      background: C.amberLight, border: `1px solid ${C.border}`,
      borderRadius: "20px", padding: "4px 14px", fontSize: "10px",
      fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "2px", color: C.amber,
    },
    h1: {
      fontSize: "clamp(26px,5vw,42px)", fontWeight: "700",
      fontFamily: "'Playfair Display', serif", color: C.text,
      margin: 0, lineHeight: "1.2", letterSpacing: "-1px",
    },
    h2: { fontSize: "22px", fontWeight: "700", fontFamily: "'Playfair Display', serif", color: C.text, margin: "0 0 20px 0" },
    h3: {
      fontSize: "11px", fontWeight: "700", fontFamily: "'IBM Plex Mono', monospace",
      color: C.amber, letterSpacing: "2px", margin: "28px 0 10px 0", textTransform: "uppercase",
    },
    meta: { fontSize: "12px", color: C.muted, fontFamily: "'IBM Plex Mono', monospace", lineHeight: "1.8", margin: 0 },
    p:    { fontSize: "15px", color: C.textSub, lineHeight: "1.85", margin: "0 0 12px 0" },
    ul:   { fontSize: "15px", color: C.textSub, lineHeight: "1.85", margin: "0 0 16px 0", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px" },
    rule: { border: "none", borderTop: `1px solid ${C.border}`, margin: "8px 0" },
    link: { color: C.amber, textDecoration: "underline", textUnderlineOffset: "3px" },
    tableWrap: { overflowX: "auto", marginBottom: "16px" },
    table:     { border: `1px solid ${C.border}`, borderRadius: "10px", overflow: "hidden", minWidth: "480px" },
    tableRow:  { display: "flex" },
    tableHead: {
      padding: "9px 14px", fontSize: "10px",
      fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "1.5px",
      color: C.muted, fontWeight: "600", textTransform: "uppercase",
      borderRight: `1px solid ${C.border}`,
    },
    tableCell: { padding: "10px 14px", fontSize: "13px", color: C.text, borderRight: `1px solid ${C.border}`, lineHeight: "1.6" },
    infoBox: {
      background: C.amberLight, border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${C.amber}`, borderRadius: "8px",
      padding: "14px 16px", fontSize: "13px", color: C.textSub, marginBottom: "16px", lineHeight: "1.7",
    },
    warningBox: {
      background: C.amberLight, border: `1px solid ${C.amber}44`,
      borderLeft: `3px solid ${C.amber}`, borderRadius: "8px",
      padding: "14px 16px", fontSize: "14px", color: C.textSub, marginBottom: "16px", lineHeight: "1.7",
    },
    footer: { padding: "20px clamp(16px,4vw,32px)", borderTop: `1px solid ${C.border}`, background: C.bgMuted },
    footerInner: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      flexWrap: "wrap", gap: "12px", maxWidth: "1000px", margin: "0 auto",
    },
  };
}

function globalCSS(C) {
  return `
    * { box-sizing: border-box; }
    body { margin: 0; background: ${C.bg}; transition: background 0.2s; }
    ::selection { background: ${C.selectionBg}; }
    ul li::marker { color: ${C.amber}; }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: ${C.bgMuted}; }
    ::-webkit-scrollbar-thumb { background: ${C.scrollThumb}; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: ${C.amber}; }

    #google_translate_element { display: none !important; }
    .goog-te-banner-frame     { display: none !important; }
    body { top: 0 !important; position: static !important; }
    body.translated-ltr, body.translated-rtl { margin-top: 0 !important; }
  `;
}
