/**
 * Nexus Chat — Application entry point
 * Auth → onboarding → shell → router
 * Desktop nav-rail + mobile tab-bar
 */

import { getState, setState } from "./state.js";
import { startRouter, register, navigate } from "./router.js";
import { showToast } from "../components/toast.js";
import { renderAuth } from "../auth/auth-ui.js";
import { initAuthListeners, loadUserData } from "../auth/auth.js";
import { renderChatList } from "../chat/chat-list.js";
import { renderChatView } from "../chat/chat-view.js";
import { renderPeople } from "../people/people.js";
import { renderSettings } from "../settings/settings.js";

/* ──────────────────────────────────────────────
   Placeholders (groups / calls — architecture ready)
────────────────────────────────────────────── */
function renderPlaceholder(title, icon = "⏳") {
  const root = document.getElementById("page-root");
  if (!root) return () => {};

  root.innerHTML = `
    <header class="app-header">
      <h1 class="app-header__title">${title}</h1>
    </header>
    <div class="page__scroll">
      <div class="empty-state">
        <div class="empty-state__icon" style="font-size:2rem">${icon}</div>
        <div class="empty-state__title">${title}</div>
        <p class="empty-state__desc">Coming soon — architecture is ready.</p>
      </div>
    </div>
  `;
  return () => {
    root.innerHTML = "";
  };
}

/* ──────────────────────────────────────────────
   Route guard — only after login + onboarding
────────────────────────────────────────────── */
function guardRoute(renderFn) {
  return (params, query) => {
    const { user, onboardingComplete } = getState();
    if (!user || !onboardingComplete) return () => {};
    return renderFn(params, query);
  };
}

/* ──────────────────────────────────────────────
   Routes
────────────────────────────────────────────── */
register("chats", guardRoute(() => renderChatList()));
register("chat/:id", guardRoute((params) => renderChatView(params)));
register("people", guardRoute(() => renderPeople()));
register("groups", guardRoute(() => renderPlaceholder("Groups", "👥")));
register("calls", guardRoute(() => renderPlaceholder("Calls", "📞")));
register("settings", guardRoute(() => renderSettings()));
register("*", () => {
  const { user, onboardingComplete } = getState();
  if (user && onboardingComplete) {
    navigate("chats", { replace: true });
  }
});

/* ──────────────────────────────────────────────
   Nav highlight (rail + tabs)
────────────────────────────────────────────── */
function highlightNav(route) {
  const primary = (route || "chats").split("/")[0];

  document.querySelectorAll(".nav-rail__btn").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === primary);
  });

  document.querySelectorAll(".tab-bar__item").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === primary);
  });
}

/* ──────────────────────────────────────────────
   Shell: Auth OR App — never both
────────────────────────────────────────────── */
function updateShell(user) {
  const authRoot = document.getElementById("auth-root");
  const shell = document.getElementById("app-shell");
  const tabBar = document.getElementById("tab-bar");
  if (!authRoot || !shell) return;

  // ── Logged out ──
  if (!user) {
    shell.hidden = true;
    if (tabBar) tabBar.hidden = true;
    authRoot.hidden = false;
    authRoot.style.display = "flex";
    renderAuth(authRoot);
    setState({
      isLoading: false,
      user: null,
      profile: null,
      privateProfile: null,
      settings: null,
      onboardingComplete: false,
    });
    if (location.hash && location.hash !== "#") {
      history.replaceState(null, "", location.pathname + location.search);
    }
    return;
  }

  const { onboardingComplete } = getState();

  // ── Onboarding incomplete ──
  if (!onboardingComplete) {
    shell.hidden = true;
    if (tabBar) tabBar.hidden = true;
    authRoot.hidden = false;
    authRoot.style.display = "flex";
    renderAuth(authRoot);
    setState({ isLoading: false });
    if (location.hash && location.hash !== "#") {
      history.replaceState(null, "", location.pathname + location.search);
    }
    return;
  }

  // ── Fully ready ──
  authRoot.hidden = true;
  authRoot.style.display = "none";
  shell.hidden = false;

  // Mobile tab bar only below 900px
  if (tabBar) {
    tabBar.hidden = window.matchMedia("(min-width: 900px)").matches;
  }

  setState({ isLoading: false });

  if (!location.hash || location.hash === "#") {
    navigate("chats", { replace: true });
  } else {
    navigate(location.hash.slice(1), { replace: true });
  }

  highlightNav(location.hash.slice(1) || "chats");
}

/** Call after onboarding completes (auth does not re-fire) */
export function refreshShell() {
  updateShell(getState().user || null);
}

/* ──────────────────────────────────────────────
   Connection indicator
────────────────────────────────────────────── */
function initConnectionMonitor() {
  const bar = document.getElementById("connection-bar");
  if (!bar) return;

  function update(status) {
    setState({ connectionStatus: status });
    bar.className = "connection-bar";
    if (status === "offline") {
      bar.textContent = "No connection";
      bar.classList.add("visible", "connection-bar--offline");
    } else if (status === "connecting") {
      bar.textContent = "Connecting…";
      bar.classList.add("visible", "connection-bar--connecting");
    } else {
      bar.classList.remove("visible");
    }
  }

  window.addEventListener("online", () => update("online"));
  window.addEventListener("offline", () => update("offline"));
  update(navigator.onLine ? "online" : "offline");
}

/* ──────────────────────────────────────────────
   Desktop nav-rail + mobile tab-bar clicks
────────────────────────────────────────────── */
function initNavigation() {
  const go = (route) => {
    const { user, onboardingComplete } = getState();
    if (!user || !onboardingComplete) return;
    highlightNav(route);
    navigate(route);
  };

  document.getElementById("nav-rail")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-route]");
    if (btn) go(btn.dataset.route);
  });

  document.getElementById("tab-bar")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-route]");
    if (btn) go(btn.dataset.route);
  });

  // Keep tab bar visibility in sync on resize
  window.addEventListener("resize", () => {
    const tabBar = document.getElementById("tab-bar");
    const shell = document.getElementById("app-shell");
    if (!tabBar || !shell || shell.hidden) return;
    const { user, onboardingComplete } = getState();
    if (user && onboardingComplete) {
      tabBar.hidden = window.matchMedia("(min-width: 900px)").matches;
    }
  });
}

/* ──────────────────────────────────────────────
   Boot
────────────────────────────────────────────── */
let authReady = false;

async function boot() {
  console.log(
    "%c Nexus ",
    "background:#5b6af0;color:#fff;padding:4px 10px;border-radius:6px;font-weight:600;"
  );

  initConnectionMonitor();
  initNavigation();

  initAuthListeners(async (user) => {
    setState({ user });

    if (user) {
      try {
        await loadUserData(user.uid);
      } catch (err) {
        console.error("loadUserData:", err);
        showToast("Could not load profile");
      }
    }

    updateShell(user);

    if (!authReady) {
      authReady = true;
      startRouter();
    }
  });
}

boot().catch((err) => {
  console.error("Boot failed:", err);
  showToast("Failed to start application");
});