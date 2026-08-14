/**
 * Auth UI — Sign In / Sign Up (Email · Google · Phone) + Onboarding
 */

import {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  sendPhoneOtp,
  verifyPhoneOtp,
  completeOnboarding,
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

export function renderAuth(container) {
  const state = getState();

  if (state.user && !state.onboardingComplete) {
    renderOnboarding(container);
    return;
  }

  container.innerHTML = "";
  container.hidden = false;
  renderAuthForm(container);
}

function renderAuthForm(container) {
  const isSignIn = mode === "signin";

  container.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <img class="auth-logo__mark" src="/public/icons/icon.png" alt="Nexus" width="64" height="64"
             onerror="this.style.display='none'" />
        <div class="auth-logo__name">Nexus</div>
        <div class="auth-logo__tagline">${isSignIn ? "Welcome back" : "Create your account"}</div>
      </div>

      <div class="auth-tabs">
        <button type="button" class="auth-tab ${isSignIn ? "active" : ""}" data-mode="signin">Sign In</button>
        <button type="button" class="auth-tab ${!isSignIn ? "active" : ""}" data-mode="signup">Sign Up</button>
      </div>

      <!-- Email form -->
      <form id="form-email" class="auth-form">
        ${!isSignIn ? `
        <div class="field">
          <label class="field__label" for="auth-name">Display name</label>
          <input class="field__input" id="auth-name" type="text" maxlength="40" placeholder="Your name" />
        </div>` : ""}
        <div class="field">
          <label class="field__label" for="auth-email">Email</label>
          <input class="field__input" id="auth-email" type="email" autocomplete="email" placeholder="you@example.com" />
        </div>
        <div class="field">
          <label class="field__label" for="auth-pass">Password</label>
          <input class="field__input" id="auth-pass" type="password"
                 autocomplete="${isSignIn ? "current-password" : "new-password"}"
                 placeholder="${isSignIn ? "••••••" : "At least 6 characters"}" />
        </div>
        <button type="submit" class="btn btn--primary btn--block" id="btn-email">
          ${isSignIn ? "Sign In" : "Create account"}
        </button>
      </form>

      <div class="auth-divider"><span>or</span></div>

      <button type="button" class="btn btn--secondary btn--block" id="btn-google">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continue with Google
      </button>

      <button type="button" class="btn btn--secondary btn--block" id="btn-phone-toggle" style="margin-top:10px">
        Continue with Phone
      </button>

      <!-- Phone panel (hidden by default) -->
      <div id="phone-panel" style="display:none;margin-top:16px">
        <div class="field" id="phone-input-wrap">
          <label class="field__label" for="auth-phone">Phone number</label>
          <input class="field__input" id="auth-phone" type="tel" placeholder="+8801XXXXXXXXX" />
          <span class="field__hint">Use country code, e.g. +880</span>
        </div>
        <div class="field" id="otp-wrap" style="display:none">
          <label class="field__label" for="auth-otp">OTP Code</label>
          <input class="field__input" id="auth-otp" type="text" inputmode="numeric" maxlength="6" placeholder="6-digit code" />
        </div>
        <button type="button" class="btn btn--primary btn--block" id="btn-phone-send">Send OTP</button>
        <button type="button" class="btn btn--primary btn--block" id="btn-phone-verify" style="display:none">Verify & Continue</button>
      </div>

      <p id="auth-error" class="field__error" style="text-align:center;margin-top:12px;min-height:18px"></p>
    </div>
  `;

  // Tabs
  container.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      mode = tab.dataset.mode;
      phoneStep = "input";
      renderAuthForm(container);
    });
  });

  // Email submit
  container.querySelector("#form-email").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = container.querySelector("#auth-email").value.trim();
    const pass = container.querySelector("#auth-pass").value;
    const nameEl = container.querySelector("#auth-name");
    const name = nameEl ? nameEl.value.trim() : "";
    const btn = container.querySelector("#btn-email");
    const errEl = container.querySelector("#auth-error");
    errEl.textContent = "";

    if (!isValidEmail(email)) {
      errEl.textContent = "Enter a valid email";
      return;
    }
    if (!isValidPassword(pass)) {
      errEl.textContent = "Password must be at least 6 characters";
      return;
    }
    if (!isSignIn && !isValidDisplayName(name)) {
      errEl.textContent = "Enter your display name";
      return;
    }

    btn.disabled = true;
    btn.textContent = isSignIn ? "Signing in…" : "Creating…";

    try {
      if (isSignIn) {
        await loginWithEmail(email, pass);
      } else {
        await registerWithEmail(email, pass);
        // displayName saved during onboarding; optionally set Auth profile
        if (auth.currentUser && name) {
          await auth.currentUser.updateProfile({ displayName: name });
        }
      }
      // onAuthStateChanged → onboarding or app
    } catch (err) {
      errEl.textContent = friendlyError(err);
      btn.disabled = false;
      btn.textContent = isSignIn ? "Sign In" : "Create account";
    }
  });

  // Google
  container.querySelector("#btn-google").addEventListener("click", async () => {
    const errEl = container.querySelector("#auth-error");
    errEl.textContent = "";
    try {
      await loginWithGoogle();
    } catch (err) {
      errEl.textContent = friendlyError(err);
    }
  });

  // Phone toggle
  const phonePanel = container.querySelector("#phone-panel");
  container.querySelector("#btn-phone-toggle").addEventListener("click", () => {
    phonePanel.style.display = phonePanel.style.display === "none" ? "block" : "none";
  });

  // Send OTP
  container.querySelector("#btn-phone-send").addEventListener("click", async () => {
    const phone = container.querySelector("#auth-phone").value.trim();
    const errEl = container.querySelector("#auth-error");
    const btn = container.querySelector("#btn-phone-send");
    errEl.textContent = "";

    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      errEl.textContent = "Enter phone with country code, e.g. +8801712345678";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      await sendPhoneOtp(phone);
      phoneStep = "otp";
      container.querySelector("#phone-input-wrap").style.display = "none";
      container.querySelector("#otp-wrap").style.display = "block";
      btn.style.display = "none";
      container.querySelector("#btn-phone-verify").style.display = "block";
      showToast("OTP sent");
    } catch (err) {
      errEl.textContent = friendlyError(err);
      btn.disabled = false;
      btn.textContent = "Send OTP";
    }
  });

  // Verify OTP
  container.querySelector("#btn-phone-verify").addEventListener("click", async () => {
    const code = container.querySelector("#auth-otp").value.trim();
    const errEl = container.querySelector("#auth-error");
    const btn = container.querySelector("#btn-phone-verify");
    errEl.textContent = "";

    if (!/^\d{6}$/.test(code)) {
      errEl.textContent = "Enter the 6-digit code";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Verifying…";
    try {
      await verifyPhoneOtp(code);
    } catch (err) {
      errEl.textContent = friendlyError(err);
      btn.disabled = false;
      btn.textContent = "Verify & Continue";
    }
  });
}

function renderOnboarding(container) {
  container.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <img class="auth-logo__mark" src="/public/icons/icon.png" alt="Nexus" width="64" height="64"
             onerror="this.style.display='none'" />
        <div class="auth-logo__name">Set up your profile</div>
        <div class="auth-logo__tagline">Choose how others will find you</div>
      </div>

      <div class="field">
        <label class="field__label" for="onb-name">Display name</label>
        <input class="field__input" id="onb-name" type="text" maxlength="40" placeholder="Your name" />
      </div>
      <div class="field">
        <label class="field__label" for="onb-username">Username</label>
        <input class="field__input" id="onb-username" type="text" maxlength="32" placeholder="johndoe" />
        <span class="field__hint">3–32 characters · letters, numbers, underscore</span>
      </div>
      <div class="field">
        <label class="field__label" for="onb-bio">Bio <span style="color:var(--text-tertiary)">(optional)</span></label>
        <textarea class="field__textarea" id="onb-bio" maxlength="160" placeholder="A short introduction"></textarea>
      </div>

      <button type="button" class="btn btn--primary btn--block" id="btn-finish">Continue</button>
      <p id="auth-error" class="field__error" style="text-align:center;margin-top:12px;min-height:18px"></p>
    </div>
  `;

  const userEl = container.querySelector("#onb-username");
  userEl.addEventListener("input", () => {
    const pos = userEl.selectionStart;
    const n = normalizeUsername(userEl.value);
    if (userEl.value !== n) {
      userEl.value = n;
      userEl.setSelectionRange(Math.max(0, pos - 1), Math.max(0, pos - 1));
    }
  });

  container.querySelector("#btn-finish").addEventListener("click", async () => {
    const displayName = container.querySelector("#onb-name").value.trim();
    const username = normalizeUsername(container.querySelector("#onb-username").value);
    const bio = container.querySelector("#onb-bio").value.trim();
    const errEl = container.querySelector("#auth-error");
    const btn = container.querySelector("#btn-finish");
    errEl.textContent = "";

    if (!isValidDisplayName(displayName)) {
      errEl.textContent = "Enter a display name (1–40 characters)";
      return;
    }
    if (!isValidUsername(username)) {
      errEl.textContent = "Username must be 3–32 characters, a–z, 0–9, _";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Saving…";

    try {
      await completeOnboarding({ displayName, username, bio });

      // Onboarding done → switch to app shell immediately
      try {
        const { refreshShell } = await import("../core/app.js");
        refreshShell();
      } catch (e) {
        console.warn("refreshShell:", e);
        // Fallback: reload so app.js picks up onboardingComplete
        window.location.hash = "chats";
        window.location.reload();
      }
    } catch (err) {
      console.error("Onboarding error:", err);
      errEl.textContent = err.message || "Could not complete setup";
      btn.disabled = false;
      btn.textContent = "Continue";
    }
  });
}

function friendlyError(err) {
  const code = err?.code || "";
  if (code.includes("email-already-in-use")) return "This email is already registered";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "Incorrect email or password";
  if (code.includes("user-not-found")) return "No account found with this email";
  if (code.includes("weak-password")) return "Password is too weak";
  if (code.includes("too-many-requests")) return "Too many attempts. Try again later";
  if (code.includes("popup-closed")) return "Sign-in cancelled";
  if (code.includes("invalid-phone-number")) return "Invalid phone number";
  if (code.includes("invalid-verification-code")) return "Wrong OTP code";
  if (code.includes("code-expired")) return "OTP expired. Send again";
  return err?.message || "Something went wrong";
}

// Need auth reference for updateProfile in signup
import { auth } from "../config/firebase.js";

export default { renderAuth };