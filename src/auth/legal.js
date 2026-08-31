/**
 * Kothiqo — Own-brand onboarding (5 steps) → Agree & Continue
 * Unique layout · green brand · not a Telegram clone
 * Logo: /public/icons/icon.png
 */

const STORAGE_KEY = "kothiqo_legal_accepted_v1";

export function hasAcceptedLegal() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch (_) {
    return false;
  }
}

export function acceptLegal() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
    localStorage.setItem("kothiqo_legal_accepted_at", new Date().toISOString());
  } catch (_) {}
}

export function revokeLegalAcceptance() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}

/* ── 5 unique steps ─────────────────────────────────────── */

const STEPS = [
  {
    id: "welcome",
    badge: "Welcome",
    title: "Conversations that\nstay yours",
    text: "Kothiqo is built for private, fast messaging — without the clutter.",
    accent: "logo",
  },
  {
    id: "speed",
    badge: "Speed",
    title: "Feel instant",
    text: "Lightweight web app, realtime sync, and a UI that stays smooth on phone and desktop.",
    accent: "bi-lightning-charge-fill",
    stat: { value: "<100ms", label: "typical send path" },
  },
  {
    id: "privacy",
    badge: "Privacy",
    title: "Share only what\nyou choose",
    text: "Public profile is separate from private account data. You control what others can see.",
    accent: "bi-shield-lock-fill",
    chips: ["No ads", "No data selling", "Username discovery"],
  },
  {
    id: "identity",
    badge: "Identity",
    title: "Find people by\n@username",
    text: "Exact username search — no noisy partial leaks. Start a chat when you’re ready.",
    accent: "bi-at",
    chips: ["Exact match", "Clean profiles"],
  },
  {
    id: "ready",
    badge: "Almost there",
    title: "Ready when\nyou are",
    text: "By continuing you accept our Terms and Privacy Policy. You can review them anytime.",
    accent: "bi-check2-circle",
    isFinal: true,
  },
];

/* ── Styles ─────────────────────────────────────────────── */

function ensureStyles() {
  if (document.getElementById("legal-styles")) return;
  const s = document.createElement("style");
  s.id = "legal-styles";
  s.textContent = `
    .kq-ob {
      --g: #00c853;
      --g2: #00e676;
      --g-soft: rgba(0, 200, 83, 0.12);
      --ink: #0f1419;
      --muted: #5c6b73;
      --line: rgba(15, 20, 25, 0.08);
      --card: #f3f6f4;
      --bg: #fafbfa;
      --foot-bg: #ffffff;

      min-height: 100%;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      background:
        radial-gradient(900px 420px at 10% -10%, rgba(0, 230, 118, 0.14), transparent 55%),
        radial-gradient(700px 380px at 100% 0%, rgba(0, 150, 80, 0.08), transparent 50%),
        var(--bg);
      color: var(--ink);
      font-family: Inter, system-ui, -apple-system, sans-serif;
      padding: max(10px, env(safe-area-inset-top)) 0 max(12px, env(safe-area-inset-bottom));
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
    }
    .kq-ob.is-dark {
      --ink: #e8eef2;
      --muted: #9aabB4;
      --line: rgba(255,255,255,0.08);
      --card: rgba(255,255,255,0.05);
      --bg: #0b1014;
      --foot-bg: #10161c;
      background:
        radial-gradient(900px 420px at 10% -10%, rgba(0, 230, 118, 0.1), transparent 55%),
        var(--bg);
    }

    .kq-ob__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 20px 0;
      max-width: 520px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }
    .kq-ob__progress {
      display: flex;
      gap: 6px;
      flex: 1;
      max-width: 160px;
    }
    .kq-ob__seg {
      flex: 1;
      height: 3px;
      border-radius: 99px;
      background: var(--line);
      overflow: hidden;
    }
    .kq-ob__seg > i {
      display: block;
      height: 100%;
      width: 0;
      background: linear-gradient(90deg, var(--g), var(--g2));
      border-radius: inherit;
      transition: width 0.35s cubic-bezier(0.2, 0.9, 0.3, 1);
    }
    .kq-ob__seg.is-done > i { width: 100%; }
    .kq-ob__seg.is-active > i { width: 100%; opacity: 1; }

    .kq-ob__skip, .kq-ob__theme {
      border: none;
      background: transparent;
      color: var(--muted);
      font-size: 0.85rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      padding: 8px 10px;
      border-radius: 8px;
    }
    .kq-ob__theme { font-size: 1.1rem; color: var(--g); }
    .kq-ob__skip:hover { color: var(--ink); }

    .kq-ob__stage {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px 24px;
      max-width: 520px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
      min-height: 0;
    }

    .kq-ob__badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 99px;
      background: var(--g-soft);
      color: var(--g);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 18px;
    }

    .kq-ob__hero {
      width: 112px;
      height: 112px;
      border-radius: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 22px;
      background: linear-gradient(145deg, rgba(0,230,118,0.2), rgba(0,150,80,0.08));
      border: 1px solid rgba(0, 200, 83, 0.25);
      box-shadow: 0 12px 40px rgba(0, 200, 83, 0.15);
      position: relative;
    }
    .kq-ob__hero::after {
      content: "";
      position: absolute;
      inset: -8px;
      border-radius: 38px;
      border: 1px solid rgba(0, 200, 83, 0.12);
      pointer-events: none;
    }
    .kq-ob__hero img {
      width: 64px;
      height: 64px;
      object-fit: contain;
    }
    .kq-ob__hero i {
      font-size: 2.6rem;
      color: var(--g);
    }

    .kq-ob__title {
      margin: 0 0 12px;
      font-size: clamp(1.55rem, 5vw, 1.9rem);
      font-weight: 750;
      letter-spacing: -0.03em;
      line-height: 1.15;
      text-align: center;
      white-space: pre-line;
    }
    .kq-ob__text {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.5;
      color: var(--muted);
      text-align: center;
      max-width: 340px;
    }

    .kq-ob__stat {
      margin-top: 20px;
      padding: 14px 18px;
      border-radius: 14px;
      background: var(--card);
      border: 1px solid var(--line);
      text-align: center;
      min-width: 160px;
    }
    .kq-ob__stat strong {
      display: block;
      font-size: 1.25rem;
      color: var(--g);
      font-weight: 750;
    }
    .kq-ob__stat span {
      font-size: 0.75rem;
      color: var(--muted);
    }

    .kq-ob__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-top: 18px;
      max-width: 340px;
    }
    .kq-ob__chip {
      padding: 7px 12px;
      border-radius: 99px;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--ink);
      background: var(--card);
      border: 1px solid var(--line);
    }

    .kq-ob__foot {
      width: 100%;
      max-width: 520px;
      margin: 0 auto;
      padding: 12px 20px 8px;
      box-sizing: border-box;
      background: linear-gradient(to top, var(--foot-bg) 70%, transparent);
    }
    .kq-ob__legal {
      font-size: 0.78rem;
      line-height: 1.45;
      color: var(--muted);
      text-align: center;
      margin: 0 0 12px;
    }
    .kq-ob__legal a {
      color: var(--g);
      font-weight: 600;
      text-decoration: none;
    }
    .kq-ob__legal a:hover { text-decoration: underline; }
    .kq-ob__legal[hidden] { display: none !important; }

    .kq-ob__actions {
      display: flex;
      gap: 10px;
    }
    .kq-ob__btn {
      flex: 1;
      min-height: 50px;
      border: none;
      border-radius: 14px;
      font-family: inherit;
      font-size: 0.95rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: transform 0.12s, filter 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .kq-ob__btn:active { transform: scale(0.98); }
    .kq-ob__btn--primary {
      background: linear-gradient(180deg, var(--g2), var(--g));
      color: #041208;
      box-shadow: 0 8px 22px rgba(0, 200, 83, 0.28);
    }
    .kq-ob__btn--primary:hover { filter: brightness(1.04); }
    .kq-ob__btn--ghost {
      flex: 0 0 auto;
      min-width: 96px;
      background: transparent;
      color: var(--muted);
      border: 1px solid var(--line);
    }

    /* Doc */
    .kq-doc {
      min-height: 100dvh;
      background: var(--bg, #fff);
      color: var(--ink, #111);
      display: flex;
      flex-direction: column;
      font-family: inherit;
    }
    .kq-doc__head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: max(12px, env(safe-area-inset-top)) 16px 12px;
      border-bottom: 1px solid var(--line, #eee);
    }
    .kq-doc__back {
      width: 40px; height: 40px; border: none; border-radius: 50%;
      background: var(--card, #f4f4f5); color: var(--g); cursor: pointer; font-size: 1.1rem;
    }
    .kq-doc__title { font-weight: 700; }
    .kq-doc__body {
      padding: 20px; overflow-y: auto; font-size: 0.9rem; line-height: 1.55; color: var(--muted);
    }
    .kq-doc__body p { margin: 0 0 12px; }
    .kq-doc__body strong { color: var(--ink); }

    @media (min-width: 900px) {
      .kq-ob__hero { width: 128px; height: 128px; border-radius: 36px; }
      .kq-ob__hero img { width: 72px; height: 72px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .kq-ob__seg > i { transition: none; }
    }
  `;
  document.head.appendChild(s);
}

/* ── Render ─────────────────────────────────────────────── */

export function renderLegalGate(container, { onAccept } = {}) {
  if (!container) return;
  ensureStyles();

  let index = 0;
  let dark =
    localStorage.getItem("kothiqo_ob_theme") === "dark" ||
    (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches &&
      localStorage.getItem("kothiqo_ob_theme") !== "light");

  const goFinal = () => {
    index = STEPS.length - 1;
    paint();
  };

  const paint = () => {
    const step = STEPS[index];
    const isLast = !!step.isFinal;

    container.hidden = false;
    container.className = "kq-ob" + (dark ? " is-dark" : "");

    const segs = STEPS.map((_, i) => {
      const cls =
        i < index ? "is-done" : i === index ? "is-active" : "";
      return `<span class="kq-ob__seg ${cls}"><i></i></span>`;
    }).join("");

    const hero =
      step.accent === "logo"
        ? `<div class="kq-ob__hero">
             <img src="/public/icons/icon.png" alt="Kothiqo"
                  onerror="this.parentElement.innerHTML='<i class=\\'bi bi-chat-quote-fill\\'></i>'" />
           </div>`
        : `<div class="kq-ob__hero"><i class="bi ${step.accent}"></i></div>`;

    const extra = step.stat
      ? `<div class="kq-ob__stat"><strong>${step.stat.value}</strong><span>${step.stat.label}</span></div>`
      : step.chips
        ? `<div class="kq-ob__chips">${step.chips
            .map((c) => `<span class="kq-ob__chip">${c}</span>`)
            .join("")}</div>`
        : "";

    container.innerHTML = `
      <div class="kq-ob__top">
        <div class="kq-ob__progress" aria-label="Step ${index + 1} of ${STEPS.length}">${segs}</div>
        <div style="display:flex;align-items:center;gap:2px">
          ${
            !isLast
              ? `<button type="button" class="kq-ob__skip" id="btn-skip">Skip</button>`
              : `<span style="width:48px"></span>`
          }
          <button type="button" class="kq-ob__theme" id="btn-theme" aria-label="Theme">
            <i class="bi ${dark ? "bi-sun-fill" : "bi-moon-stars-fill"}"></i>
          </button>
        </div>
      </div>

      <div class="kq-ob__stage" id="ob-stage">
        <span class="kq-ob__badge">${step.badge}</span>
        ${hero}
        <h1 class="kq-ob__title">${step.title}</h1>
        <p class="kq-ob__text">${step.text}</p>
        ${extra}
      </div>

      <div class="kq-ob__foot">
        <p class="kq-ob__legal" ${isLast ? "" : "hidden"}>
          <a href="#privacy" id="link-privacy">Privacy Policy</a>
          ·
          <a href="#terms" id="link-terms">Terms of Service</a>
        </p>
        <div class="kq-ob__actions">
          ${
            index > 0
              ? `<button type="button" class="kq-ob__btn kq-ob__btn--ghost" id="btn-back">Back</button>`
              : ""
          }
          ${
            isLast
              ? `<button type="button" class="kq-ob__btn kq-ob__btn--primary" id="btn-agree">
                   Agree and Continue <i class="bi bi-arrow-right"></i>
                 </button>`
              : `<button type="button" class="kq-ob__btn kq-ob__btn--primary" id="btn-next">
                   Continue <i class="bi bi-arrow-right"></i>
                 </button>`
          }
        </div>
      </div>
    `;

    container.querySelector("#btn-theme")?.addEventListener("click", () => {
      dark = !dark;
      localStorage.setItem("kothiqo_ob_theme", dark ? "dark" : "light");
      paint();
    });
    container.querySelector("#btn-skip")?.addEventListener("click", goFinal);
    container.querySelector("#btn-back")?.addEventListener("click", () => {
      if (index > 0) {
        index -= 1;
        paint();
      }
    });
    container.querySelector("#btn-next")?.addEventListener("click", () => {
      if (index < STEPS.length - 1) {
        index += 1;
        paint();
      }
    });
    container.querySelector("#btn-agree")?.addEventListener("click", () => {
      acceptLegal();
      onAccept?.();
    });
    container.querySelector("#link-terms")?.addEventListener("click", (e) => {
      e.preventDefault();
      showDoc(container, "Terms of Service", TERMS_HTML, paint);
    });
    container.querySelector("#link-privacy")?.addEventListener("click", (e) => {
      e.preventDefault();
      showDoc(container, "Privacy Policy", PRIVACY_HTML, paint);
    });

    bindSwipe(container.querySelector("#ob-stage"), {
      onLeft: () => {
        if (index < STEPS.length - 1) {
          index += 1;
          paint();
        }
      },
      onRight: () => {
        if (index > 0) {
          index -= 1;
          paint();
        }
      },
    });
  };

  paint();
}

function bindSwipe(el, { onLeft, onRight }) {
  if (!el) return;
  let x0 = null;
  el.addEventListener(
    "touchstart",
    (e) => {
      x0 = e.changedTouches[0].clientX;
    },
    { passive: true }
  );
  el.addEventListener(
    "touchend",
    (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 48) return;
      if (dx < 0) onLeft?.();
      else onRight?.();
    },
    { passive: true }
  );
}

function showDoc(container, title, html, onBack) {
  container.className = "kq-ob";
  container.innerHTML = `
    <div class="kq-doc">
      <div class="kq-doc__head">
        <button type="button" class="kq-doc__back" id="doc-back"><i class="bi bi-arrow-left"></i></button>
        <span class="kq-doc__title">${title}</span>
      </div>
      <div class="kq-doc__body">${html}</div>
    </div>
  `;
  container.querySelector("#doc-back")?.addEventListener("click", onBack);
}

const TERMS_HTML = `
<style>
  .kq-terms {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 0.875rem;
    line-height: 1.7;
    color: #3b4a54;
    max-width: 680px;
    margin: 0 auto;
    padding: 0 4px;
  }

  .kq-terms h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #111b21;
    letter-spacing: -0.02em;
    margin: 0 0 4px;
  }

  .kq-terms .kq-terms-meta {
    font-size: 0.75rem;
    color: #8696a0;
    margin: 0 0 20px;
    display: block;
  }

  .kq-terms .kq-terms-intro {
    background: #f0faf6;
    border-left: 3px solid #00a884;
    border-radius: 0 8px 8px 0;
    padding: 12px 14px;
    margin-bottom: 20px;
    font-size: 0.82rem;
    color: #2d5a4a;
    line-height: 1.55;
  }

  .kq-terms h3 {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #00a884;
    margin: 22px 0 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e9f5f1;
  }

  .kq-terms p {
    margin: 0 0 10px;
  }

  .kq-terms p:last-child {
    margin-bottom: 0;
  }

  .kq-terms strong {
    color: #111b21;
    font-weight: 600;
  }

  .kq-terms ul {
    margin: 8px 0 12px;
    padding-left: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .kq-terms ul li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 0.83rem;
    color: #3b4a54;
    line-height: 1.5;
  }

  .kq-terms ul li::before {
    content: '';
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #00a884;
    margin-top: 6px;
    opacity: 0.7;
  }

  .kq-terms em {
    display: block;
    margin-top: 20px;
    padding: 10px 14px;
    background: #fff8e1;
    border-radius: 8px;
    font-size: 0.78rem;
    color: #7a6000;
    font-style: normal;
    border: 1px solid #ffe082;
    line-height: 1.5;
  }
</style>

<div class="kq-terms">
  <h2>Kothiqo Terms of Service</h2>
  <span class="kq-terms-meta">Last Updated: August 30, 2026</span>

  <div class="kq-terms-intro">
    Welcome to <strong>Kothiqo</strong>. These Terms of Service ("Terms")
    govern your access to and use of the Kothiqo messaging application,
    website, software, features and related services.<br><br>
    By creating an account, accessing or using Kothiqo, or tapping
    "Agree and Continue", you acknowledge that you have read, understood
    and agreed to these Terms.
  </div>

  <h3>1. The Kothiqo Service</h3>
  <p>
    Kothiqo provides messaging and communication features that may include
    text messaging, voice messages, voice or video calls, media sharing,
    file sharing, profiles, notifications and other related functionality.
  </p>
  <p>
    Features may change, be added, suspended or removed as Kothiqo evolves.
    Some features may not be available in every country, device or account.
  </p>

  <h3>2. Eligibility</h3>
  <p>
    You may use Kothiqo only if you are legally permitted to use the service
    under the laws applicable to you.
  </p>
  <p>
    If you are below the applicable minimum age for using Kothiqo, you may
    use the service only where permitted by applicable law and with any
    required parental or guardian consent.
  </p>

  <h3>3. Your Account</h3>
  <p>
    You are responsible for maintaining the security of your account,
    authentication information, verification codes and devices used to
    access Kothiqo.
  </p>
  <p>You must provide accurate information where information is required to create or maintain your account.</p>
  <p>You must not share authentication codes, intentionally allow unauthorized
    access to your account, or attempt to use another person's account
    without authorization.</p>
  <p>You are responsible for activity performed through your account unless
    the activity resulted from unauthorized access that was not reasonably
    within your control.</p>

  <h3>4. Acceptable Use</h3>
  <p>You agree to use Kothiqo lawfully, responsibly and respectfully.</p>
  <p>You must not use Kothiqo to:</p>
  <ul>
    <li>Send spam, bulk unsolicited messages or fraudulent communications.</li>
    <li>Harass, threaten, stalk, intimidate or abuse another person.</li>
    <li>Impersonate another person, organization or service.</li>
    <li>Distribute malware, viruses or other malicious software.</li>
    <li>Conduct phishing, scams, fraud or other deceptive activities.</li>
    <li>Attempt unauthorized access to accounts, servers or systems.</li>
    <li>Probe, scan or test Kothiqo systems without authorization.</li>
    <li>Bypass security, authentication, rate limits or access controls.</li>
    <li>Exploit bugs or vulnerabilities for malicious purposes.</li>
    <li>Use automated systems to overload, scrape or abuse the service.</li>
    <li>Distribute content that violates applicable law.</li>
    <li>Facilitate criminal activity or serious harm to others.</li>
  </ul>

  <h3>5. User Content</h3>
  <p>You retain ownership of the content you create, upload or send through
    Kothiqo, subject to the rights necessary for Kothiqo to operate the service.</p>
  <p>You are solely responsible for the content you send, publish, upload or
    otherwise make available through Kothiqo.</p>
  <p>You represent that you have the necessary rights and permissions to
    share content that you submit through the service.</p>

  <h3>6. Content and Privacy</h3>
  <p>Kothiqo may process information and user content as necessary to provide,
    maintain, secure and improve the service, subject to the <strong>Privacy Policy</strong>.</p>
  <p>Where end-to-end encryption is implemented, Kothiqo is designed so that
    message content is protected from unauthorized access during transmission.
    However, encryption does not protect information after it is exposed
    through a compromised device, screenshots, recipient actions, insecure
    backups or other circumstances outside Kothiqo's control.</p>

  <h3>7. Prohibited Content</h3>
  <p>You must not use Kothiqo to distribute, promote or facilitate content
    that is unlawful or that creates a serious risk of harm to others.</p>
  <p>This may include content involving fraud, malicious software, credible
    threats, exploitation, unauthorized access, or other activities
    prohibited by applicable law.</p>

  <h3>8. Safety and Enforcement</h3>
  <p>To protect Kothiqo and its users, we may investigate violations of these
    Terms and take reasonable enforcement action where appropriate.</p>
  <p>Depending on the severity, frequency and circumstances of a violation,
    enforcement actions may include:</p>
  <ul>
    <li>Warning or notification.</li>
    <li>Removal or restriction of violating content where appropriate.</li>
    <li>Temporary restriction of specific features.</li>
    <li>Temporary account suspension.</li>
    <li>Permanent account termination.</li>
    <li>Restriction of future account creation where appropriate.</li>
    <li>Disclosure to law enforcement where legally required or permitted.</li>
  </ul>
  <p>Serious security abuse, fraud, threats, exploitation, unauthorized
    access attempts or other unlawful conduct may result in immediate
    restriction or termination without prior warning where reasonably
    necessary to protect users or the service.</p>

  <h3>9. Security</h3>
  <p>You must not interfere with the security or operation of Kothiqo.</p>
  <p>You must not attempt to discover, exploit, reverse engineer or abuse
    vulnerabilities, authentication systems, encryption mechanisms,
    infrastructure or other security controls except as expressly
    authorized by Kothiqo.</p>
  <p>If you discover a potential security vulnerability, you should report it
    through the official Kothiqo security contact rather than exploiting it.</p>

  <h3>10. Intellectual Property</h3>
  <p>Kothiqo and its licensors retain all rights, title and interest in the
    Kothiqo application, software, source code, design, interface, logo,
    trademarks, branding and other proprietary materials, except for
    third-party materials and rights expressly granted to users.</p>
  <p>You may not copy, modify, distribute, sell, sublicense, reverse engineer
    or create derivative works from Kothiqo or its proprietary components
    unless expressly permitted by Kothiqo or applicable law.</p>

  <h3>11. Third-Party Software</h3>
  <p>Kothiqo may contain or depend on third-party and open-source software.
    Such components may be governed by their own licenses and terms.</p>
  <p>Nothing in these Terms is intended to restrict rights granted to you
    under applicable open-source licenses.</p>

  <h3>12. Service Availability</h3>
  <p>We aim to keep Kothiqo available and reliable, but we do not guarantee
    that the service will always be available, uninterrupted, secure,
    error-free or compatible with every device.</p>
  <p>Kothiqo may temporarily suspend or limit access for maintenance,
    upgrades, security incidents, technical failures, legal requirements
    or other operational reasons.</p>

  <h3>13. Changes to the Service</h3>
  <p>We may modify, improve, add or remove features from Kothiqo at any time.
    Some changes may be necessary for security, legal compliance,
    performance or technical reasons.</p>

  <h3>14. Account Termination</h3>
  <p>You may stop using Kothiqo and request deletion of your account subject
    to the applicable account deletion process.</p>
  <p>Kothiqo may suspend or terminate an account if you materially violate
    these Terms, create a significant security or safety risk, engage in
    unlawful activity, or where termination is reasonably necessary to
    protect the service or its users.</p>

  <h3>15. Disclaimer</h3>
  <p>To the maximum extent permitted by applicable law, Kothiqo is provided
    on an "as available" and "as is" basis without guarantees that the
    service will meet every individual requirement or remain uninterrupted.</p>
  <p>Nothing in these Terms excludes or limits rights or protections that
    cannot legally be excluded or limited under applicable law.</p>

  <h3>16. Limitation of Liability</h3>
  <p>To the maximum extent permitted by applicable law, Kothiqo and its
    operators will not be responsible for indirect, incidental, special,
    consequential or punitive damages arising from use of the service,
    except where such limitation is prohibited by law.</p>

  <h3>17. Legal Compliance</h3>
  <p>You are responsible for complying with the laws and regulations
    applicable to your use of Kothiqo and the content you transmit through
    the service.</p>
  <p>Kothiqo may cooperate with valid legal requests and applicable
    law-enforcement processes where required or legally permitted.</p>

  <h3>18. Changes to These Terms</h3>
  <p>We may update these Terms from time to time. When material changes are
    made, we may provide notice through Kothiqo or another appropriate method.</p>
  <p>Your continued use of Kothiqo after updated Terms become effective
    constitutes acceptance of the revised Terms to the extent permitted
    by applicable law.</p>

  <h3>19. Contact</h3>
  <p>For questions regarding these Terms, account issues, abuse reports or
    legal matters, please use the official Kothiqo support or legal contact
    provided within the application or on the official Kothiqo website.</p>

  <em>
    These Terms are a general legal-policy template and are not legal
    advice. They should be reviewed and finalized by qualified legal
    counsel before Kothiqo is released publicly.
  </em>
</div>
`;

const PRIVACY_HTML = `
<style>
  .kq-privacy {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 0.875rem;
    line-height: 1.7;
    color: #3b4a54;
    max-width: 680px;
    margin: 0 auto;
    padding: 0 4px;
  }

  .kq-privacy h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #111b21;
    letter-spacing: -0.02em;
    margin: 0 0 4px;
  }

  .kq-privacy .kq-privacy-meta {
    font-size: 0.75rem;
    color: #8696a0;
    margin: 0 0 20px;
    display: block;
  }

  .kq-privacy .kq-privacy-intro {
    background: #f0faf6;
    border-left: 3px solid #00a884;
    border-radius: 0 8px 8px 0;
    padding: 12px 14px;
    margin-bottom: 20px;
    font-size: 0.82rem;
    color: #2d5a4a;
    line-height: 1.55;
  }

  .kq-privacy h3 {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #00a884;
    margin: 22px 0 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e9f5f1;
  }

  .kq-privacy p {
    margin: 0 0 10px;
  }

  .kq-privacy p:last-child {
    margin-bottom: 0;
  }

  .kq-privacy strong {
    color: #111b21;
    font-weight: 600;
  }

  .kq-privacy ul {
    margin: 8px 0 12px;
    padding-left: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .kq-privacy ul li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 0.83rem;
    color: #3b4a54;
    line-height: 1.5;
  }

  .kq-privacy ul li::before {
    content: '';
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #00a884;
    margin-top: 6px;
    opacity: 0.7;
  }

  .kq-privacy .kq-privacy-highlight {
    background: #e8f5fe;
    border-left: 3px solid #027eb5;
    border-radius: 0 8px 8px 0;
    padding: 10px 14px;
    margin: 10px 0;
    font-size: 0.82rem;
    color: #1a4a6b;
    line-height: 1.55;
  }

  .kq-privacy .kq-privacy-nosell {
    background: #f0faf6;
    border: 1px solid #b2dfdb;
    border-radius: 8px;
    padding: 10px 14px;
    margin: 10px 0;
    font-size: 0.85rem;
    color: #1b5e45;
    font-weight: 600;
    text-align: center;
    letter-spacing: 0.01em;
  }

  .kq-privacy em {
    display: block;
    margin-top: 20px;
    padding: 10px 14px;
    background: #fff8e1;
    border-radius: 8px;
    font-size: 0.78rem;
    color: #7a6000;
    font-style: normal;
    border: 1px solid #ffe082;
    line-height: 1.5;
  }
</style>

<div class="kq-privacy">
  <h2>Kothiqo Privacy Policy</h2>
  <span class="kq-privacy-meta">Last Updated: August 30, 2026</span>

  <div class="kq-privacy-intro">
    Welcome to <strong>Kothiqo</strong>. We respect your privacy and are
    committed to protecting your personal information. This Privacy Policy
    explains what information we collect, how we use it, how we protect it,
    and what choices you have when using Kothiqo.
  </div>

  <h3>1. Information We Collect</h3>
  <p><strong>Account Information</strong> — We may collect information required
    to create and maintain your account, such as your phone number, email
    address, username, account identifier, profile name, and profile picture.
    The exact information collected depends on the registration method used by Kothiqo.</p>
  <p><strong>Profile Information</strong> — Information that you choose to
    make public, such as your username, display name, profile picture, bio,
    or other public profile fields, may be visible to other Kothiqo users.</p>
  <p><strong>Messages and Media</strong> — Kothiqo may process messages,
    photos, videos, files, voice messages, reactions, and other content that
    you send or receive in order to provide messaging functionality.</p>
  <p><strong>Technical and Security Information</strong> — We may collect
    device information, application version, IP address, connection
    information, crash information, authentication records, timestamps,
    security events, and other technical logs necessary to operate and
    secure the service.</p>

  <h3>2. How We Use Information</h3>
  <p>We may use collected information to:</p>
  <ul>
    <li>Create and authenticate user accounts.</li>
    <li>Deliver and synchronize messages.</li>
    <li>Provide messaging, calling, media and file-sharing features.</li>
    <li>Maintain and improve Kothiqo.</li>
    <li>Detect spam, abuse, fraud and unauthorized access.</li>
    <li>Protect users, infrastructure and the Kothiqo service.</li>
    <li>Investigate security incidents and violations.</li>
    <li>Provide customer and technical support.</li>
    <li>Comply with applicable legal obligations.</li>
  </ul>

  <h3>3. Encryption and Message Security</h3>
  <p>Kothiqo is designed with security and privacy in mind. Where
    end-to-end encryption is implemented, message content is encrypted
    before transmission and is intended to be readable only by the
    communicating parties.</p>
  <p>Encryption does not guarantee absolute security. Account credentials,
    unlocked devices, screenshots, backups, compromised devices, malicious
    applications, or actions performed by recipients may expose information
    outside the protection of the messaging encryption system.</p>
  <div class="kq-privacy-highlight">
    <strong>Important:</strong> The exact encryption technology, key
    management system, backup encryption and server-side processing used by
    Kothiqo should be accurately documented before production release.
  </div>

  <h3>4. Security Measures</h3>
  <p>We may use reasonable technical and organizational safeguards to protect
    information against unauthorized access, alteration, disclosure,
    destruction, abuse and loss.</p>
  <ul>
    <li>Secure authentication mechanisms.</li>
    <li>Encrypted network communication where applicable.</li>
    <li>Access controls and authorization.</li>
    <li>Security monitoring and abuse detection.</li>
    <li>Rate limiting and anti-spam protections.</li>
    <li>Security logging and incident investigation.</li>
    <li>Regular maintenance and security updates.</li>
  </ul>
  <p>No internet service, application, server or electronic transmission can
    be guaranteed to be completely secure.</p>

  <h3>5. Data Sharing</h3>
  <div class="kq-privacy-nosell">🔒 We do not sell your personal information.</div>
  <p>We may disclose limited information when reasonably necessary to operate
    Kothiqo, provide infrastructure or technical services, prevent abuse,
    protect users, investigate security incidents, comply with legal
    requirements, or protect our legal rights.</p>
  <p>Public profile information that you intentionally make visible may be
    accessible to other users.</p>

  <h3>6. Third-Party Services</h3>
  <p>Kothiqo may use third-party infrastructure or service providers for
    hosting, authentication, notifications, analytics, crash reporting,
    storage, security, payments or other operational purposes.</p>
  <p>Third-party services may process information according to their own
    privacy policies and applicable agreements. A current list of material
    third-party services should be maintained by Kothiqo before production launch.</p>

  <h3>7. Device Permissions</h3>
  <p>Depending on the features you use, Kothiqo may request access to
    permissions such as camera, microphone, notifications, contacts,
    photos/files or location.</p>
  <p>Permissions are requested only when required for a feature. You may
    generally control permissions through your device settings, although
    disabling a permission may prevent the related feature from working.</p>

  <h3>8. Data Retention</h3>
  <p>We retain information only for as long as reasonably necessary to provide
    the service, maintain security, resolve disputes, enforce our policies,
    meet legal obligations, or fulfill other legitimate operational purposes.</p>
  <p>Retention periods may differ depending on the type of information and
    the purpose for which it is processed.</p>

  <h3>9. Account Deletion</h3>
  <p>You may request deletion of your Kothiqo account, subject to applicable
    legal, security, fraud-prevention and operational requirements.</p>
  <p>Deleting an account may not immediately remove information that must be
    retained for legal compliance, security investigations, dispute
    resolution, fraud prevention, backups or other legitimate purposes.</p>

  <h3>10. User Content</h3>
  <p>You retain ownership of content that you create and submit to Kothiqo,
    subject to the rights and permissions necessary for Kothiqo to provide the service.</p>
  <p>You are responsible for ensuring that content you upload, transmit or
    share does not violate applicable law or the rights of other people.</p>

  <h3>11. Prohibited Activities</h3>
  <p>Users must not use Kothiqo to:</p>
  <ul>
    <li>Conduct unlawful activities.</li>
    <li>Harass, threaten, stalk or intimidate other users.</li>
    <li>Send spam, scams, phishing messages or fraudulent content.</li>
    <li>Distribute malware or malicious software.</li>
    <li>Attempt unauthorized access to accounts, servers or systems.</li>
    <li>Abuse, bypass or interfere with Kothiqo security mechanisms.</li>
    <li>Impersonate another person or organization.</li>
    <li>Distribute content that violates applicable law.</li>
    <li>Use automated systems to abuse or overload the service.</li>
    <li>Exploit bugs or vulnerabilities for malicious purposes.</li>
  </ul>

  <h3>12. Safety and Enforcement</h3>
  <p>Kothiqo may take reasonable enforcement action when users violate
    applicable laws, these policies, or the security and safety rules of the service.</p>
  <p>Depending on the severity and circumstances of a violation, actions may
    include warnings, content restrictions, feature restrictions, temporary
    suspension, permanent account termination, removal of violating content
    where technically and legally appropriate, or referral to appropriate
    authorities where required or permitted by law.</p>
  <p>Serious security abuse, fraud, threats, exploitation, unauthorized
    access attempts or other unlawful activity may result in immediate
    restriction or termination without prior warning where appropriate.</p>

  <h3>13. Intellectual Property and License</h3>
  <p>The Kothiqo application, name, logo, branding, interface, software,
    source code, design elements and other proprietary materials are owned
    by or licensed to Kothiqo and are protected by applicable intellectual property laws.</p>
  <p>Except where expressly permitted by Kothiqo or applicable law, users may
    not copy, modify, distribute, reverse engineer, resell, sublicense,
    reproduce or create derivative works from Kothiqo software or branding.</p>
  <p>Third-party libraries, open-source components and other licensed
    technologies included in Kothiqo remain subject to their respective licenses.</p>

  <h3>14. Children's Privacy</h3>
  <p>Kothiqo is not intended for users who are prohibited from using the
    service under applicable age or privacy laws. We do not knowingly
    collect personal information from children in violation of applicable law.</p>

  <h3>15. Legal Requests</h3>
  <p>Kothiqo may disclose information when required by applicable law,
    valid legal process, court order, or lawful governmental request.
    Where legally permitted, we may take reasonable steps to protect user
    privacy when responding to such requests.</p>

  <h3>16. International Data Processing</h3>
  <p>Depending on where Kothiqo and its service providers operate, your
    information may be processed or stored in countries other than your
    country of residence. Appropriate safeguards should be implemented
    where required by applicable data protection laws.</p>

  <h3>17. Changes to This Privacy Policy</h3>
  <p>We may update this Privacy Policy from time to time. When material
    changes are made, we may provide appropriate notice through Kothiqo
    or another legally appropriate method.</p>

  <h3>18. Contact</h3>
  <p>If you have questions, privacy requests or security concerns regarding
    Kothiqo, please contact the official Kothiqo support or privacy contact
    provided within the application or on the official Kothiqo website.</p>

  <em>
    This Privacy Policy is a general product-policy template and is not
    legal advice. Before publishing Kothiqo, have this document reviewed
    and finalized by qualified legal counsel for the countries and
    jurisdictions in which Kothiqo will operate.
  </em>
</div>
`;
export default {
  hasAcceptedLegal,
  acceptLegal,
  revokeLegalAcceptance,
  renderLegalGate,
};