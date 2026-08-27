/**
 * Auth UI — Sign In / Sign Up (Email · Google · Phone) + Onboarding
 * Modern card UI · Bootstrap Icons · matches Nexus theme tokens
 */

import { auth } from "../config/firebase.js";
import {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  sendPhoneOtp,
  verifyPhoneOtp,
  completeOnboarding,
  sendPasswordReset,
  mapAuthError,
} from "./auth.js";
import { getState } from "../core/state.js";
import { showToast } from "../components/toast.js";
import {
  isValidEmail,
  isValidPassword,
  isValidDisplayName,
  isValidUsername,
  normalizeUsername,
} from "../utils/validation.js";

let mode = "signin"; // signin | signup
let phoneStep = "input"; // input | otp

/* ═══════════════════════════════════════════════════════════
   STYLES (injected once)
═══════════════════════════════════════════════════════════ */

function ensureAuthStyles() {
  if (document.getElementById("auth-ui-styles")) return;
  const style = document.createElement("style");
  style.id = "auth-ui-styles";
  style.textContent = `
    #auth-root, .auth-screen {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      box-sizing: border-box;
      background:
        radial-gradient(1200px 600px at 10% -10%, rgba(91,106,240,0.18), transparent 55%),
        radial-gradient(900px 500px at 100% 0%, rgba(37,211,102,0.08), transparent 50%),
        var(--surface-0, #0f1117);
    }

    .auth-card {
      width: min(400px, 100%);
      background: var(--surface-1, #1a1d27);
      border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
      border-radius: 20px;
      padding: 28px 24px 24px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.35);
    }

    .auth-logo {
      text-align: center;
      margin-bottom: 20px;
    }
    .auth-logo__mark {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      object-fit: cover;
      margin-bottom: 10px;
      box-shadow: 0 8px 24px rgba(91,106,240,0.25);
    }
    .auth-logo__name {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text-primary, #e9edef);
    }
    .auth-logo__tagline {
      margin-top: 4px;
      font-size: 0.9rem;
      color: var(--text-secondary, #aebac1);
    }

    .auth-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 4px;
      background: var(--surface-2, rgba(255,255,255,0.05));
      border-radius: 12px;
      margin-bottom: 18px;
    }
    .auth-tab {
      border: none;
      background: transparent;
      color: var(--text-secondary, #aebac1);
      font-weight: 600;
      font-size: 14px;
      padding: 10px;
      border-radius: 10px;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, color 0.15s;
    }
    .auth-tab.active {
      background: var(--surface-1, #1a1d27);
      color: var(--text-primary, #e9edef);
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .auth-card .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .auth-card .field__label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary, #aebac1);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .auth-card .field__input,
    .auth-card .field__textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--border-default, rgba(255,255,255,0.1));
      background: var(--surface-2, rgba(255,255,255,0.05));
      color: var(--text-primary, #e9edef);
      font-size: 15px;
      font-family: inherit;
      outline: none;
      transition: box-shadow 0.15s, border-color 0.15s;
    }
    .auth-card .field__textarea {
      resize: vertical;
      min-height: 72px;
    }
    .auth-card .field__input:focus,
    .auth-card .field__textarea:focus {
      border-color: transparent;
      box-shadow: 0 0 0 2px var(--color-accent, #5b6af0);
    }
    .auth-card .field__hint {
      font-size: 12px;
      color: var(--text-tertiary, #8696a0);
    }
    .auth-card .field__error {
      font-size: 13px;
      color: var(--color-danger, #e53935);
      min-height: 18px;
    }

    .auth-card .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 46px;
      padding: 0 16px;
      border-radius: 12px;
      border: none;
      font-weight: 600;
      font-size: 15px;
      font-family: inherit;
      cursor: pointer;
      transition: filter 0.15s, opacity 0.15s, transform 0.1s;
    }
    .auth-card .btn:active:not(:disabled) { transform: scale(0.98); }
    .auth-card .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .auth-card .btn--block { width: 100%; }
    .auth-card .btn--primary {
      background: linear-gradient(135deg, #5b6af0, #7c5cff);
      color: #fff;
      box-shadow: 0 8px 20px rgba(91,106,240,0.3);
    }
    .auth-card .btn--primary:hover:not(:disabled) { filter: brightness(1.05); }
    .auth-card .btn--secondary {
      background: var(--surface-2, rgba(255,255,255,0.06));
      color: var(--text-primary, #e9edef);
      border: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
    }
    .auth-card .btn--secondary:hover:not(:disabled) {
      background: rgba(255,255,255,0.09);
    }
    .auth-card .btn--ghost {
      background: transparent;
      color: var(--color-accent, #5b6af0);
      min-height: 36px;
      font-size: 13px;
    }

    .auth-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 16px 0;
      color: var(--text-tertiary, #8696a0);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .auth-divider::before,
    .auth-divider::after {
      content: "";
      flex: 1;
      height: 1px;
      background: var(--border-subtle, rgba(255,255,255,0.08));
    }

    .auth-social {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .auth-foot {
      margin-top: 14px;
      text-align: center;
    }

    #phone-panel {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.08));
      display: none;
    }
    #phone-panel.is-open { display: block; }

    @media (max-width: 480px) {
      .auth-card {
        padding: 24px 18px 20px;
        border-radius: 16px;
      }
    }
  `;
  document.head.appendChild(style);
}

/* ═══════════════════════════════════════════════════════════
   PUBLIC ENTRY
═══════════════════════════════════════════════════════════ */

/**
 * @param {HTMLElement} container
 */
export function renderAuth(container) {
  if (!container) return;

  ensureAuthStyles();

  const state = getState();
  container.hidden = false;
  container.classList.add("auth-screen");

  if (state.user && !state.onboardingComplete) {
    renderOnboarding(container);
    return;
  }

  renderAuthForm(container);
}

/* ═══════════════════════════════════════════════════════════
   SIGN IN / SIGN UP FORM
═══════════════════════════════════════════════════════════ */

function renderAuthForm(container) {
  const isSignIn = mode === "signin";

  container.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <img class="auth-logo__mark" src="/public/icons/icon.png" alt="Nexus"
             width="64" height="64" onerror="this.style.display='none'" />
        <div class="auth-logo__name">Nexus</div>
        <div class="auth-logo__tagline">
          ${isSignIn ? "Welcome back — sign in to continue" : "Create your private account"}
        </div>
      </div>

      <div class="auth-tabs" role="tablist">
        <button type="button" class="auth-tab ${isSignIn ? "active" : ""}" data-mode="signin" role="tab">
          Sign In
        </button>
        <button type="button" class="auth-tab ${!isSignIn ? "active" : ""}" data-mode="signup" role="tab">
          Sign Up
        </button>
      </div>

      <form id="form-email" class="auth-form" novalidate>
        ${
          !isSignIn
            ? `
          <div class="field">
            <label class="field__label" for="auth-name">Display name</label>
            <input class="field__input" id="auth-name" type="text" maxlength="40"
                   placeholder="Your name" autocomplete="name" />
          </div>`
            : ""
        }
        <div class="field">
          <label class="field__label" for="auth-email">Email</label>
          <input class="field__input" id="auth-email" type="email"
                 autocomplete="email" placeholder="you@example.com" />
        </div>
        <div class="field">
          <label class="field__label" for="auth-pass">Password</label>
          <input class="field__input" id="auth-pass" type="password"
                 autocomplete="${isSignIn ? "current-password" : "new-password"}"
                 placeholder="${isSignIn ? "Your password" : "At least 6 characters"}" />
        </div>
        <button type="submit" class="btn btn--primary btn--block" id="btn-email">
          <i class="bi bi-${isSignIn ? "box-arrow-in-right" : "person-plus"}"></i>
          ${isSignIn ? "Sign In" : "Create account"}
        </button>
      </form>

      ${
        isSignIn
          ? `<div class="auth-foot">
               <button type="button" class="btn btn--ghost" id="btn-forgot">Forgot password?</button>
             </div>`
          : ""
      }

      <div class="auth-divider"><span>or</span></div>

      <div class="auth-social">
        <button type="button" class="btn btn--secondary btn--block" id="btn-google">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <button type="button" class="btn btn--secondary btn--block" id="btn-phone-toggle">
          <i class="bi bi-phone"></i>
          Continue with Phone
        </button>
      </div>

      <div id="phone-panel">
        <div class="field" id="phone-input-wrap">
          <label class="field__label" for="auth-phone">Phone number</label>
          <input class="field__input" id="auth-phone" type="tel"
                 placeholder="+8801XXXXXXXXX" autocomplete="tel" />
          <span class="field__hint">International format with country code</span>
        </div>
        <div class="field" id="otp-wrap" hidden>
          <label class="field__label" for="auth-otp">Verification code</label>
          <input class="field__input" id="auth-otp" type="text" inputmode="numeric"
                 maxlength="6" placeholder="6-digit code" autocomplete="one-time-code" />
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
          <button type="button" class="btn btn--primary btn--block" id="btn-phone-send">
            <i class="bi bi-send"></i> Send OTP
          </button>
          <button type="button" class="btn btn--primary btn--block" id="btn-phone-verify" hidden>
            <i class="bi bi-shield-check"></i> Verify &amp; Continue
          </button>
        </div>
      </div>

      <p id="auth-error" class="field__error" style="text-align:center;margin-top:14px"></p>
    </div>
  `;

  bindAuthForm(container, isSignIn);
}

function bindAuthForm(container, isSignIn) {
  const errEl = () => container.querySelector("#auth-error");

  /* Tabs */
  container.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      mode = tab.dataset.mode || "signin";
      phoneStep = "input";
      renderAuthForm(container);
    });
  });

  /* Email */
  container.querySelector("#form-email")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = container.querySelector("#auth-email")?.value.trim() || "";
    const pass = container.querySelector("#auth-pass")?.value || "";
    const name = container.querySelector("#auth-name")?.value.trim() || "";
    const btn = container.querySelector("#btn-email");
    const error = errEl();
    if (error) error.textContent = "";

    if (!isValidEmail(email)) {
      if (error) error.textContent = "Enter a valid email";
      return;
    }
    if (!isValidPassword(pass)) {
      if (error) error.textContent = "Password must be at least 6 characters";
      return;
    }
    if (!isSignIn && !isValidDisplayName(name)) {
      if (error) error.textContent = "Enter your display name";
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>${isSignIn ? "Signing in…" : "Creating…"}</span>`;
    }

    try {
      if (isSignIn) {
        await loginWithEmail(email, pass);
      } else {
        await registerWithEmail(email, pass);
        if (auth.currentUser && name) {
          try {
            await auth.currentUser.updateProfile({ displayName: name });
          } catch (_) {}
        }
      }
      // auth.onAuthStateChanged → shell / onboarding
    } catch (err) {
      if (error) error.textContent = friendlyError(err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <i class="bi bi-${isSignIn ? "box-arrow-in-right" : "person-plus"}"></i>
          ${isSignIn ? "Sign In" : "Create account"}
        `;
      }
    }
  });

  /* Forgot password */
  container.querySelector("#btn-forgot")?.addEventListener("click", async () => {
    const email = container.querySelector("#auth-email")?.value.trim() || "";
    const error = errEl();
    if (error) error.textContent = "";
    if (!isValidEmail(email)) {
      if (error) error.textContent = "Enter your email above, then tap Forgot password";
      return;
    }
    try {
      await sendPasswordReset(email);
      showToast("Password reset email sent", { type: "success" });
    } catch (err) {
      if (error) error.textContent = friendlyError(err);
    }
  });

  /* Google */
  container.querySelector("#btn-google")?.addEventListener("click", async () => {
    const error = errEl();
    if (error) error.textContent = "";
    try {
      await loginWithGoogle();
    } catch (err) {
      if (error) error.textContent = friendlyError(err);
    }
  });

  /* Phone panel toggle */
  const phonePanel = container.querySelector("#phone-panel");
  container.querySelector("#btn-phone-toggle")?.addEventListener("click", () => {
    phonePanel?.classList.toggle("is-open");
  });

  /* Send OTP */
  container.querySelector("#btn-phone-send")?.addEventListener("click", async () => {
    const phone = (container.querySelector("#auth-phone")?.value || "")
      .trim()
      .replace(/[\s-]/g, "");
    const error = errEl();
    const btn = container.querySelector("#btn-phone-send");
    if (error) error.textContent = "";

    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      if (error) {
        error.textContent = "Enter phone with country code, e.g. +8801712345678";
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "Sending…";
    }

    try {
      await sendPhoneOtp(phone);
      phoneStep = "otp";
      const inputWrap = container.querySelector("#phone-input-wrap");
      const otpWrap = container.querySelector("#otp-wrap");
      const verifyBtn = container.querySelector("#btn-phone-verify");
      if (inputWrap) inputWrap.hidden = true;
      if (otpWrap) otpWrap.hidden = false;
      if (btn) btn.hidden = true;
      if (verifyBtn) verifyBtn.hidden = false;
      showToast("OTP sent", { type: "success" });
    } catch (err) {
      if (error) error.textContent = friendlyError(err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-send"></i> Send OTP`;
      }
    }
  });

  /* Verify OTP */
  container.querySelector("#btn-phone-verify")?.addEventListener("click", async () => {
    const code = (container.querySelector("#auth-otp")?.value || "").trim();
    const error = errEl();
    const btn = container.querySelector("#btn-phone-verify");
    if (error) error.textContent = "";

    if (!/^\d{6}$/.test(code)) {
      if (error) error.textContent = "Enter the 6-digit code";
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "Verifying…";
    }

    try {
      await verifyPhoneOtp(code);
    } catch (err) {
      if (error) error.textContent = friendlyError(err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-shield-check"></i> Verify & Continue`;
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   ONBOARDING
═══════════════════════════════════════════════════════════ */

function renderOnboarding(container) {
  const prefill = getState().user?.displayName || "";

  container.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <img class="auth-logo__mark" src="/public/icons/icon.png" alt="Nexus"
             width="64" height="64" onerror="this.style.display='none'" />
        <div class="auth-logo__name">Set up your profile</div>
        <div class="auth-logo__tagline">Choose how others will find you on Nexus</div>
      </div>

      <div class="auth-form">
        <div class="field">
          <label class="field__label" for="onb-name">Display name</label>
          <input class="field__input" id="onb-name" type="text" maxlength="40"
                 placeholder="Your name" value="${escapeAttr(prefill)}" />
        </div>
        <div class="field">
          <label class="field__label" for="onb-username">UsernameUsername</label>
          <input class="field__input" id="onb-username" type="text" maxlength="32"
                 placeholder="johndoe" autocomplete="username" />
          <span class="field__hint">3–32 characters · a–z, 0–9, underscore</span>
        </div>
        <div class="field">
          <label class="field__label" for="onb-bio">Bio (optional)</label>
          <textarea class="field__textarea" id="onb-bio" maxlength="160"
                    placeholder="A short introduction"></textarea>
        </div>
        <button type="button" class="btn btn--primary btn--block" id="btn-finish">
          <i class="bi bi-check2-circle"></i> Continue
        </button>
        <p id="auth-error" class="field__error" style="text-align:center"></p>
      </div>
    </div>
  `;

  const userEl = container.querySelector("#onb-username");
  userEl?.addEventListener("input", () => {
    const pos = userEl.selectionStart;
    const n = normalizeUsername(userEl.value);
    if (userEl.value !== n) {
      userEl.value = n;
      const caret = Math.max(0, (pos || 0) - 1);
      userEl.setSelectionRange(caret, caret);
    }
  });

  container.querySelector("#btn-finish")?.addEventListener("click", async () => {
    const displayName = container.querySelector("#onb-name")?.value.trim() || "";
    const username = normalizeUsername(
      container.querySelector("#onb-username")?.value || ""
    );
    const bio = container.querySelector("#onb-bio")?.value.trim() || "";
    const errEl = container.querySelector("#auth-error");
    const btn = container.querySelector("#btn-finish");
    if (errEl) errEl.textContent = "";

    if (!isValidDisplayName(displayName)) {
      if (errEl) errEl.textContent = "Enter a display name (1–40 characters)";
      return;
    }
    if (!isValidUsername(username)) {
      if (errEl) {
        errEl.textContent = "Username must be 3–32 characters, a–z, 0–9, _";
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "Saving…";
    }

    try {
      await completeOnboarding({ displayName, username, bio });

      try {
        const mod = await import("../core/app.js");
        if (typeof mod.refreshShell === "function") mod.refreshShell();
      } catch (_) {
        window.location.hash = "chats";
      }
    } catch (err) {
      console.error("Onboarding error:", err);
      if (errEl) errEl.textContent = err.message || "Could not complete setup";
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="bi bi-check2-circle"></i> Continue`;
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */

function friendlyError(err) {
  if (err?.message && !err.code) {
    // Already mapped in auth.js
    return err.message;
  }
  try {
    return mapAuthError(err);
  } catch (_) {
    return err?.message || "Something went wrong";
  }
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export default { renderAuth };