/**
 * Simple hash-based router for Nexus Chat.
 */

import { getState, setState } from "./state.js";

const routes = new Map();
let currentCleanup = null;
let routerReady = false;

export function register(path, handler) {
  routes.set(path, handler);
}

export function navigate(path, { replace = false } = {}) {
  const hash = "#" + (path.startsWith("/") ? path.slice(1) : path);
  if (replace) {
    history.replaceState(null, "", hash);
  } else {
    history.pushState(null, "", hash);
  }
  handleRoute();
}

function parseHash() {
  const raw = (location.hash || "#").slice(1);
  const [pathPart, queryPart] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const query = {};
  if (queryPart) {
    queryPart.split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      query[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
  }
  return { segments, path: segments.join("/"), query };
}

function matchRoute(segments) {
  const exact = segments.join("/");
  if (routes.has(exact)) {
    return { handler: routes.get(exact), params: {} };
  }

  for (const [pattern, handler] of routes) {
    const parts = pattern.split("/");
    if (parts.length !== segments.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(":")) {
        params[parts[i].slice(1)] = segments[i];
      } else if (parts[i] !== segments[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { handler, params };
  }

  if (routes.has("*")) {
    return { handler: routes.get("*"), params: {} };
  }
  return null;
}

export function handleRoute() {
  if (!routerReady) return;

  if (typeof currentCleanup === "function") {
    try {
      currentCleanup();
    } catch (e) {
      console.error("Route cleanup error:", e);
    }
    currentCleanup = null;
  }

  const { user, onboardingComplete } = getState();

  // Not ready for app → do not render any app page
  if (!user || !onboardingComplete) {
    setState({ currentRoute: "auth", activeConversationId: null });
    document.querySelectorAll(".tab-bar__item").forEach((el) => {
      el.classList.remove("active");
    });
    return;
  }

  const { segments, path, query } = parseHash();

  // Empty hash while logged in → go to chats
  if (!segments.length) {
    navigate("chats", { replace: true });
    return;
  }

  const match = matchRoute(segments);
  const primary = segments[0] || "chats";

  setState({
    currentRoute: primary,
    activeConversationId: primary === "chat" ? segments[1] || null : null,
  });

  document.querySelectorAll(".tab-bar__item").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === primary);
  });

  if (match) {
    currentCleanup = match.handler(match.params, query) || null;
  } else {
    navigate("chats", { replace: true });
  }
}

/**
 * Call this AFTER first auth state is known
 */
export function startRouter() {
  if (routerReady) return;
  routerReady = true;

  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("popstate", handleRoute);

  document.getElementById("tab-bar")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-route]");
    if (btn) {
      e.preventDefault();
      const { user, onboardingComplete } = getState();
      if (!user || !onboardingComplete) return;
      navigate(btn.dataset.route);
    }
  });

  handleRoute();
}

/** @deprecated use startRouter */
export function initRouter() {
  // Do nothing on boot — wait for auth
}

export default { register, navigate, handleRoute, startRouter, initRouter };