/**
 * Simple toast notifications
 */

let container = null;

function getContainer() {
  if (!container) {
    container = document.getElementById("toast-container");
  }
  return container;
}

/**
 * Show a toast message.
 * @param {string} message
 * @param {{ duration?: number }} options
 */
export function showToast(message, { duration = 2800 } = {}) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  el.setAttribute("role", "status");

  const parent = getContainer();
  if (!parent) return;

  parent.appendChild(el);

  const remove = () => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    el.style.transition = "opacity 150ms, transform 150ms";
    setTimeout(() => el.remove(), 160);
  };

  setTimeout(remove, duration);
  el.addEventListener("click", remove);
}

export default { showToast };