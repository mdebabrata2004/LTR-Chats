/**
 * Security settings
 * - Change password (email accounts)
 * - Active sessions → device.js
 * - Two-step hint (architecture only)
 * - Blocked users entry
 */

import { auth } from "../config/firebase.js";
import { showToast } from "../components/toast.js";
import { navigate } from "../core/router.js";
import {
  listDevices,
  getDeviceId,
  removeOtherDevices,
  registerCurrentDevice,
} from "./device.js";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Provider helper */
export function getSignInMethods() {
  const user = auth.currentUser;
  if (!user) return [];
  return (user.providerData || []).map((p) => p.providerId);
}

export function canChangePassword() {
  return getSignInMethods().includes("password");
}

/**
 * Re-auth + change password (email/password users only)
 */
export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("Not signed in with email");
  }
  if (!canChangePassword()) {
    throw new Error("Password change is only available for email accounts");
  }
  if (!newPassword || newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters");
  }

  const credential = firebase.auth.EmailAuthProvider.credential(
    user.email,
    currentPassword
  );
  await user.reauthenticateWithCredential(credential);
  await user.updatePassword(newPassword);
}

/**
 * Send password-reset email (works even if session is password-based)
 */
export async function sendPasswordReset() {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("No email on this account");
  await auth.sendPasswordResetEmail(user.email);
}

/* ─────────────────────────── UI ─────────────────────────── */

/**
 * HTML block for Settings
 */
export function securitySectionHtml() {
  const methods = getSignInMethods();
  const methodLabel = methods.length
    ? methods
        .map((m) => {
          if (m === "password") return "Email";
          if (m === "google.com") return "Google";
          if (m === "phone") return "Phone";
          return m;
        })
        .join(" · ")
    : "—";

  const passwordOk = canChangePassword();

  return `
    <div class="tg-section" data-section="security">
      <div class="tg-section__label">Security</div>

      <div class="tg-row">
        <i class="bi bi-shield-lock tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Sign-in method</div>
          <div class="tg-row__sub">${escapeHtml(methodLabel)}</div>
        </div>
      </div>

      ${
        passwordOk
          ? `<button type="button" class="tg-row tg-row--btn" id="btn-change-password">
               <i class="bi bi-key tg-row__icon"></i>
               <div class="tg-row__body">
                 <div class="tg-row__title">Change password</div>
                 <div class="tg-row__sub">Update your account password</div>
               </div>
               <i class="bi bi-chevron-right tg-row__chevron"></i>
             </button>`
          : `<div class="tg-row">
               <i class="bi bi-key tg-row__icon"></i>
               <div class="tg-row__body">
                 <div class="tg-row__title">Change password</div>
                 <div class="tg-row__sub">Not available for Google / Phone sign-in</div>
               </div>
             </div>`
      }

      <button type="button" class="tg-row tg-row--btn" id="btn-security-sessions">
        <i class="bi bi-laptop tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Active sessions</div>
          <div class="tg-row__sub">See devices logged into your account</div>
        </div>
        <i class="bi bi-chevron-right tg-row__chevron"></i>
      </button>

      <button type="button" class="tg-row tg-row--btn" id="btn-terminate-others-sec">
        <i class="bi bi-shield-x tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Log out other devices</div>
          <div class="tg-row__sub">Keep only this device signed in</div>
        </div>
      </button>

      <button type="button" class="tg-row tg-row--btn" id="btn-two-step">
        <i class="bi bi-shield-check tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Two-step verification</div>
          <div class="tg-row__sub">Coming soon</div>
        </div>
        <span class="tg-row__value">Off</span>
      </button>

      <button type="button" class="tg-row tg-row--btn" id="btn-security-blocked">
        <i class="bi bi-slash-circle tg-row__icon"></i>
        <div class="tg-row__body">
          <div class="tg-row__title">Blocked users</div>
        </div>
        <i class="bi bi-chevron-right tg-row__chevron"></i>
      </button>
    </div>

    <!-- Change password sheet -->
    <div id="password-overlay" class="settings-overlay" hidden>
      <div class="settings-sheet" role="dialog" aria-modal="true" aria-label="Change password">
        <div class="settings-sheet__head">
          <button type="button" class="btn btn--ghost" id="pw-cancel">Cancel</button>
          <strong>Change password</strong>
          <button type="button" class="btn btn--primary btn--sm" id="pw-save">Save</button>
        </div>
        <div class="settings-sheet__body">
          <div class="field">
            <label class="field__label">Current password</label>
            <input class="field__input" id="pw-current" type="password" autocomplete="current-password" />
          </div>
          <div class="field">
            <label class="field__label">New password</label>
            <input class="field__input" id="pw-new" type="password" autocomplete="new-password" minlength="8" />
          </div>
          <div class="field">
            <label class="field__label">Confirm new password</label>
            <input class="field__input" id="pw-confirm" type="password" autocomplete="new-password" minlength="8" />
          </div>
          <button type="button" class="btn btn--secondary btn--block" id="pw-reset-email">
            Send reset email instead
          </button>
        </div>
      </div>
    </div>
  `;
}

function openOverlay(el) {
  if (!el) return;
  el.hidden = false;
  el.classList.add("is-open");
}

function closeOverlay(el) {
  if (!el) return;
  el.hidden = true;
  el.classList.remove("is-open");
}

/**
 * Bind security controls (pass root that contains section + overlay)
 */
export function bindSecurityControls(root) {
  if (!root) return;

  const overlay = root.querySelector("#password-overlay");

  root.querySelector("#btn-change-password")?.addEventListener("click", () => {
    openOverlay(overlay);
  });

  root.querySelector("#pw-cancel")?.addEventListener("click", () => {
    closeOverlay(overlay);
  });

  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) closeOverlay(overlay);
  });

  root.querySelector("#pw-save")?.addEventListener("click", async () => {
    const current = root.querySelector("#pw-current")?.value || "";
    const next = root.querySelector("#pw-new")?.value || "";
    const confirm = root.querySelector("#pw-confirm")?.value || "";
    const btn = root.querySelector("#pw-save");

    if (!current || !next) {
      showToast("Fill all password fields");
      return;
    }
    if (next !== confirm) {
      showToast("New passwords do not match");
      return;
    }
    if (next.length < 8) {
      showToast("Use at least 8 characters");
      return;
    }

    const oldText = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving…";
    }
    try {
      await changePassword(current, next);
      closeOverlay(overlay);
      showToast("Password updated");
      root.querySelector("#pw-current").value = "";
      root.querySelector("#pw-new").value = "";
      root.querySelector("#pw-confirm").value = "";
    } catch (err) {
      const code = err?.code || "";
      if (code.includes("wrong-password") || code.includes("invalid-credential")) {
        showToast("Current password is incorrect");
      } else if (code.includes("requires-recent-login")) {
        showToast("Please sign in again, then retry");
      } else {
        showToast(err.message || "Could not update password");
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText || "Save";
      }
    }
  });

  root.querySelector("#pw-reset-email")?.addEventListener("click", async () => {
    try {
      await sendPasswordReset();
      showToast("Reset email sent");
    } catch (err) {
      showToast(err.message || "Could not send email");
    }
  });

  root.querySelector("#btn-security-sessions")?.addEventListener("click", async () => {
    try {
      await registerCurrentDevice();
      const devices = await listDevices();
      showToast(`${devices.length} active session(s)`);
      // Prefer dedicated devices page if routed
      try {
        navigate("settings");
      } catch (_) {}
    } catch (err) {
      showToast("Could not load sessions");
    }
  });

  root.querySelector("#btn-terminate-others-sec")?.addEventListener("click", async () => {
    if (!confirm("Log out from all other devices?")) return;
    try {
      await registerCurrentDevice();
      const n = await removeOtherDevices();
      showToast(n ? `Removed ${n} session(s)` : "No other sessions");
    } catch (err) {
      showToast(err.message || "Failed");
    }
  });

  root.querySelector("#btn-two-step")?.addEventListener("click", () => {
    showToast("Two-step verification — coming soon");
  });

  root.querySelector("#btn-security-blocked")?.addEventListener("click", () => {
    showToast("Blocked users — coming soon");
  });
}

/**
 * Optional full page
 */
export function renderSecurity() {
  const root = document.getElementById("page-root");
  if (!root) return () => {};

  const isDesktop = window.matchMedia("(min-width: 900px)").matches;

  root.innerHTML = `
    <header class="app-header">
      ${
        !isDesktop
          ? `<button type="button" class="btn btn--icon btn--ghost" id="btn-security-back" aria-label="Back">
               <i class="bi bi-arrow-left" style="font-size:1.25rem"></i>
             </button>`
          : ""
      }
      <h1 class="app-header__title">Security</h1>
    </header>
    <div class="page__scroll">
      ${securitySectionHtml()}
    </div>
  `;

  root.querySelector("#btn-security-back")?.addEventListener("click", () => {
    navigate("settings");
  });

  bindSecurityControls(root);

  return () => {
    root.innerHTML = "";
  };
}

export default {
  getSignInMethods,
  canChangePassword,
  changePassword,
  sendPasswordReset,
  securitySectionHtml,
  bindSecurityControls,
  renderSecurity,
};