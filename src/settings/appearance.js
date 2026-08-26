/**
 * Appearance — theme (light / dark / system)
 * Used by Settings page
 */

import { db, auth } from "../config/firebase.js";
import { getState, applyTheme } from "../core/state.js";
import { showToast } from "../components/toast.js";

const FieldValue = firebase.firestore.FieldValue;

/**
 * Persist theme to Firestore userSettings
 */
export async function saveTheme(theme) {
  const me = auth.currentUser;
  if (!me) return;
  if (!["light", "dark", "system"].includes(theme)) return;

  await db.collection("userSettings").doc(me.uid).set(
    {
      theme,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Apply + save theme, update chip UI if container given
 * @param {"light"|"dark"|"system"} theme
 * @param {ParentNode} [chipContainer] - element that holds .theme-chip buttons
 */
export async function setAppearanceTheme(theme, chipContainer) {
  applyTheme(theme);

  if (chipContainer) {
    chipContainer.querySelectorAll(".theme-chip").forEach((c) => {
      c.classList.toggle("active", c.dataset.theme === theme);
    });
  }

  try {
    await saveTheme(theme);
  } catch (err) {
    console.warn("saveTheme:", err);
  }

  const label =
    theme === "system" ? "System theme" : theme === "dark" ? "Dark mode" : "Light mode";
  showToast(label);
}

/**
 * HTML snippet for theme chips (Telegram-style)
 */
export function appearanceSectionHtml() {
  const theme = getState().theme || "system";
  return `
    <div class="tg-section" data-section="appearance">
      <div class="tg-section__label">Appearance</div>
      <div class="theme-chips" id="appearance-chips" style="padding: 8px 12px 14px">
        <button type="button" class="theme-chip ${theme === "light" ? "active" : ""}" data-theme="light">
          <i class="bi bi-sun"></i> Light
        </button>
        <button type="button" class="theme-chip ${theme === "dark" ? "active" : ""}" data-theme="dark">
          <i class="bi bi-moon"></i> Dark
        </button>
        <button type="button" class="theme-chip ${theme === "system" ? "active" : ""}" data-theme="system">
          <i class="bi bi-circle-half"></i> System
        </button>
      </div>
    </div>
  `;
}

/**
 * Bind click handlers on theme chips inside root
 * @param {ParentNode} root
 */
export function bindAppearanceControls(root) {
  const chips = root.querySelector("#appearance-chips") || root;
  chips.querySelectorAll(".theme-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const t = chip.dataset.theme;
      if (!t) return;
      setAppearanceTheme(t, chips);
    });
  });
}

/**
 * Optional: standalone mini-page render (if routed separately)
 */
export function renderAppearance(container) {
  if (!container) return () => {};

  container.innerHTML = `
    <header class="app-header">
      <h1 class="app-header__title">Appearance</h1>
    </header>
    <div class="page__scroll">
      ${appearanceSectionHtml()}
    </div>
  `;

  bindAppearanceControls(container);

  return () => {
    container.innerHTML = "";
  };
}

export default {
  saveTheme,
  setAppearanceTheme,
  appearanceSectionHtml,
  bindAppearanceControls,
  renderAppearance,
};