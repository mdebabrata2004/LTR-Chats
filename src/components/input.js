/**
 * Form inputs — field HTML, bind, validation display
 */

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let styleReady = false;

export function ensureInputStyles() {
  if (styleReady || document.getElementById("nx-input-styles")) {
    styleReady = true;
    return;
  }
  const style = document.createElement("style");
  style.id = "nx-input-styles";
  style.textContent = `
    .nx-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
    }
    .nx-field__label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary, #aebac1);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .nx-field__label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .nx-field__hint {
      font-size: 12px;
      color: var(--text-tertiary, #8696a0);
      line-height: 1.35;
    }
    .nx-field__error {
      font-size: 12px;
      color: var(--color-danger, #e53935);
      min-height: 16px;
      line-height: 1.35;
    }
    .nx-field__counter {
      font-size: 11px;
      color: var(--text-tertiary, #8696a0);
    }
    .nx-field__input,
    .nx-field__textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 11px 14px;
      border-radius: 10px;
      font-size: 15px;
      font-family: inherit;
      line-height: 1.35;
      color: var(--text-primary, #e9edef);
      background: var(--surface-2, rgba(255,255,255,0.06));
      border: 1px solid var(--border-default, rgba(255,255,255,0.1));
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .nx-field__textarea {
      resize: vertical;
      min-height: 80px;
    }
    .nx-field__input:focus,
    .nx-field__textarea:focus {
      border-color: transparent;
      box-shadow: 0 0 0 2px var(--color-accent, #5b6af0);
    }
    .nx-field--error .nx-field__input,
    .nx-field--error .nx-field__textarea {
      border-color: var(--color-danger, #e53935);
      box-shadow: none;
    }
    .nx-field__wrap {
      display: flex;
      align-items: center;
      border-radius: 10px;
      border: 1px solid var(--border-default, rgba(255,255,255,0.1));
      background: var(--surface-2, rgba(255,255,255,0.06));
      overflow: hidden;
    }
    .nx-field__wrap:focus-within {
      border-color: transparent;
      box-shadow: 0 0 0 2px var(--color-accent, #5b6af0);
    }
    .nx-field__prefix {
      padding: 0 0 0 14px;
      color: var(--text-secondary, #aebac1);
      font-size: 15px;
      flex-shrink: 0;
    }
    .nx-field__wrap .nx-field__input {
      border: none;
      background: transparent;
      box-shadow: none;
      border-radius: 0;
    }
    .nx-field__wrap .nx-field__input:focus {
      box-shadow: none;
    }
    .nx-field__suffix {
      padding-right: 10px;
      color: var(--text-secondary, #aebac1);
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);
  styleReady = true;
}

/**
 * Text field
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} [opts.label]
 * @param {string} [opts.type="text"]
 * @param {string} [opts.placeholder]
 * @param {string} [opts.value]
 * @param {string} [opts.hint]
 * @param {string} [opts.autocomplete]
 * @param {number} [opts.maxlength]
 * @param {string} [opts.prefix] — e.g. "@"
 * @param {boolean} [opts.required]
 */
export function textFieldHtml(opts = {}) {
  ensureInputStyles();
  const id = opts.id || `field-${Math.random().toString(36).slice(2, 8)}`;
  const type = opts.type || "text";
  const input = `
    <input
      class="nx-field__input"
      id="${escapeHtml(id)}"
      type="${escapeHtml(type)}"
      placeholder="${escapeHtml(opts.placeholder || "")}"
      value="${escapeHtml(opts.value || "")}"
      ${opts.maxlength != null ? `maxlength="${opts.maxlength}"` : ""}
      ${opts.autocomplete ? `autocomplete="${escapeHtml(opts.autocomplete)}"` : ""}
      ${opts.required ? "required" : ""}
    />
  `;

  const control = opts.prefix
    ? `<div class="nx-field__wrap">
         <span class="nx-field__prefix">${escapeHtml(opts.prefix)}</span>
         ${input}
       </div>`
    : input;

  return `
    <div class="nx-field" data-field="${escapeHtml(id)}">
      ${
        opts.label
          ? `<label class="nx-field__label" for="${escapeHtml(id)}">${escapeHtml(opts.label)}</label>`
          : ""
      }
      ${control}
      ${opts.hint ? `<div class="nx-field__hint">${escapeHtml(opts.hint)}</div>` : ""}
      <div class="nx-field__error" data-error-for="${escapeHtml(id)}"></div>
    </div>
  `;
}

/**
 * Textarea field
 */
export function textareaFieldHtml(opts = {}) {
  ensureInputStyles();
  const id = opts.id || `field-${Math.random().toString(36).slice(2, 8)}`;
  const max = opts.maxlength;
  const val = opts.value || "";

  return `
    <div class="nx-field" data-field="${escapeHtml(id)}">
      <div class="nx-field__label-row">
        ${
          opts.label
            ? `<label class="nx-field__label" for="${escapeHtml(id)}">${escapeHtml(opts.label)}</label>`
            : `<span></span>`
        }
        ${
          max != null
            ? `<span class="nx-field__counter" data-counter-for="${escapeHtml(id)}">${val.length}/${max}</span>`
            : ""
        }
      </div>
      <textarea
        class="nx-field__textarea"
        id="${escapeHtml(id)}"
        rows="${opts.rows || 3}"
        placeholder="${escapeHtml(opts.placeholder || "")}"
        ${max != null ? `maxlength="${max}"` : ""}
      >${escapeHtml(val)}</textarea>
      ${opts.hint ? `<div class="nx-field__hint">${escapeHtml(opts.hint)}</div>` : ""}
      <div class="nx-field__error" data-error-for="${escapeHtml(id)}"></div>
    </div>
  `;
}

/**
 * Set / clear error under a field
 */
export function setFieldError(fieldId, message) {
  const err = document.querySelector(`[data-error-for="${fieldId}"]`);
  const wrap = document.querySelector(`[data-field="${fieldId}"]`);
  if (err) err.textContent = message || "";
  if (wrap) wrap.classList.toggle("nx-field--error", !!message);
}

export function clearFieldError(fieldId) {
  setFieldError(fieldId, "");
}

/**
 * Read value
 */
export function getFieldValue(fieldId) {
  const el = document.getElementById(fieldId);
  return el ? String(el.value || "") : "";
}

/**
 * Bind maxlength counter for textarea/input
 */
export function bindCharCounter(fieldId) {
  const el = document.getElementById(fieldId);
  const counter = document.querySelector(`[data-counter-for="${fieldId}"]`);
  if (!el || !counter) return () => {};
  const max = el.getAttribute("maxlength");
  const update = () => {
    counter.textContent = max ? `${el.value.length}/${max}` : String(el.value.length);
  };
  el.addEventListener("input", update);
  update();
  return () => el.removeEventListener("input", update);
}

/**
 * Normalize username while typing (@ strip, lowercase)
 * @param {HTMLInputElement} input
 * @param {(v: string) => string} normalizeFn
 */
export function bindNormalize(input, normalizeFn) {
  if (!input || typeof normalizeFn !== "function") return () => {};
  const onInput = () => {
    const pos = input.selectionStart;
    const next = normalizeFn(input.value);
    if (input.value !== next) {
      const diff = input.value.length - next.length;
      input.value = next;
      const caret = Math.max(0, (pos || 0) - diff);
      input.setSelectionRange(caret, caret);
    }
  };
  input.addEventListener("input", onInput);
  return () => input.removeEventListener("input", onInput);
}

export default {
  ensureInputStyles,
  textFieldHtml,
  textareaFieldHtml,
  setFieldError,
  clearFieldError,
  getFieldValue,
  bindCharCounter,
  bindNormalize,
};