/**
 * Message bubble HTML renderer
 * Used by chat-view.js
 */

import { formatMessageTime, isWithin24Hours } from "../utils/date.js";
import { reactionsHtml } from "./reactions.js";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Linkify http(s) URLs in plain text (escaped first)
 */
function linkify(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a class="msg-link" href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

/**
 * Single message → HTML
 * @param {object} msg
 * @param {string} meUid
 * @param {{ showSender?: boolean, senderName?: string }} [opts]
 */
export function renderMessage(msg, meUid, opts = {}) {
  if (!msg || !msg.id) return "";

  const isOut = msg.senderId === meUid;
  const side = isOut ? "out" : "in";

  // Deleted (for everyone)
  if (msg.deleted === true) {
    return `
      <div class="msg deleted ${side}" data-mid="${escapeHtml(msg.id)}">
        <span class="msg-deleted-label">
          <i class="bi bi-slash-circle"></i> This message was deleted
        </span>
      </div>
    `;
  }

  const time = msg.createdAt ? formatMessageTime(msg.createdAt) : "";
  const canDelete = isOut && isWithin24Hours(msg.createdAt);
  const type = msg.type || "text";

  let body = "";

  if (type === "image" && msg.mediaURL) {
    body = `
      <a class="msg-media" href="${escapeHtml(msg.mediaURL)}" target="_blank" rel="noopener">
        <img class="msg-image" src="${escapeHtml(msg.mediaURL)}" alt="Image" loading="lazy" />
      </a>
      ${msg.text ? `<div class="msg-body">${linkify(msg.text)}</div>` : ""}
    `;
  } else if (type === "file" && msg.mediaURL) {
    const name = escapeHtml(msg.fileName || "File");
    const size = msg.fileSizeLabel ? escapeHtml(msg.fileSizeLabel) : "";
    body = `
      <a class="msg-file" href="${escapeHtml(msg.mediaURL)}" target="_blank" rel="noopener">
        <i class="bi bi-file-earmark"></i>
        <span class="msg-file__meta">
          <span class="msg-file__name">${name}</span>
          ${size ? `<span class="msg-file__size">${size}</span>` : ""}
        </span>
      </a>
      ${msg.text ? `<div class="msg-body">${linkify(msg.text)}</div>` : ""}
    `;
  } else if (type === "audio" && msg.mediaURL) {
    body = `
      <audio class="msg-audio" controls preload="metadata" src="${escapeHtml(msg.mediaURL)}"></audio>
    `;
  } else {
    // text (default)
    body = `<div class="msg-body">${linkify(msg.text || "")}</div>`;
  }

  // Reply quote (optional)
  let reply = "";
  if (msg.replyTo?.text || msg.replyTo?.id) {
    reply = `
      <div class="msg-reply">
        <div class="msg-reply__bar"></div>
        <div class="msg-reply__content">
          ${msg.replyTo.senderName ? `<div class="msg-reply__name">${escapeHtml(msg.replyTo.senderName)}</div>` : ""}
          <div class="msg-reply__text">${escapeHtml(msg.replyTo.text || "Message")}</div>
        </div>
      </div>
    `;
  }

  const sender =
    opts.showSender && !isOut && opts.senderName
      ? `<div class="msg-sender">${escapeHtml(opts.senderName)}</div>`
      : "";

  const ticks = isOut
    ? `<span class="msg-ticks" title="Sent"><i class="bi bi-check2-all"></i></span>`
    : "";

  const reactions = reactionsHtml(msg.reactions, meUid);

  return `
    <div class="msg ${side}"
         data-mid="${escapeHtml(msg.id)}"
         data-can-delete="${canDelete ? "1" : "0"}"
         data-type="${escapeHtml(type)}">
      ${sender}
      ${reply}
      ${body}
      <div class="msg-meta">
        <span class="msg-time">${time}</span>
        ${ticks}
      </div>
      ${reactions}
    </div>
  `;
}

/**
 * Render list of messages
 * @param {object[]} messages - oldest → newest
 * @param {string} meUid
 * @param {{ groupSender?: boolean, nameForUid?: (uid: string) => string }} [opts]
 */
export function renderMessageList(messages, meUid, opts = {}) {
  if (!Array.isArray(messages) || !messages.length) return "";

  return messages
    .map((msg, i) => {
      const prev = messages[i - 1];
      const showSender =
        !!opts.groupSender &&
        msg.senderId !== meUid &&
        (!prev || prev.senderId !== msg.senderId);

      const senderName =
        showSender && opts.nameForUid ? opts.nameForUid(msg.senderId) : "";

      return renderMessage(msg, meUid, { showSender, senderName });
    })
    .join("");
}

/**
 * Day separator label
 */
export function daySeparatorHtml(ts) {
  const ms =
    typeof ts?.toMillis === "function"
      ? ts.toMillis()
      : ts instanceof Date
        ? ts.getTime()
        : typeof ts === "number"
          ? ts
          : null;
  if (ms == null) return "";

  const d = new Date(ms);
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);

  let label;
  if (d.toDateString() === now.toDateString()) label = "Today";
  else if (d.toDateString() === y.toDateString()) label = "Yesterday";
  else {
    label = d.toLocaleDateString([], {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }

  return `<div class="msg-day" data-day="${d.toDateString()}"><span>${label}</span></div>`;
}

/**
 * List with day separators
 */
export function renderMessageListWithDays(messages, meUid, opts = {}) {
  if (!Array.isArray(messages) || !messages.length) return "";

  const parts = [];
  let lastDay = "";

  messages.forEach((msg, i) => {
    const ms =
      typeof msg.createdAt?.toMillis === "function"
        ? msg.createdAt.toMillis()
        : null;
    if (ms != null) {
      const key = new Date(ms).toDateString();
      if (key !== lastDay) {
        lastDay = key;
        parts.push(daySeparatorHtml(msg.createdAt));
      }
    }

    const prev = messages[i - 1];
    const showSender =
      !!opts.groupSender &&
      msg.senderId !== meUid &&
      (!prev || prev.senderId !== msg.senderId);
    const senderName =
      showSender && opts.nameForUid ? opts.nameForUid(msg.senderId) : "";

    parts.push(renderMessage(msg, meUid, { showSender, senderName }));
  });

  return parts.join("");
}

/** CSS for bubbles (append in chat-view) */
export const MESSAGE_CSS = `
  .msg {
    max-width: min(78%, 420px);
    padding: 6px 10px 4px;
    border-radius: 10px;
    font-size: 14.5px;
    line-height: 1.4;
    position: relative;
    word-break: break-word;
    box-shadow: 0 1px 0.5px rgba(0,0,0,0.08);
  }
  .msg.out {
    align-self: flex-end;
    background: var(--bubble-out);
    color: var(--bubble-out-text);
    border-bottom-right-radius: 3px;
  }
  .msg.in {
    align-self: flex-start;
    background:: var(--bubble-in);
    color: var(--bubble-in-text);
    border-bottom-left-radius: 3px;
  }
  .msg.deleted { opacity: 0.65; font-style: italic; box-shadow: none; }
  .msg-deleted-label { font-size: 13px; display: inline-flex; align-items: center; gap: 6px; }
  .msg-body { white-space: pre-wrap; }
  .msg-meta {
    display: inline-flex; align-items: center; gap: 3px;
    float: right; margin: 2px 0 0 12px;
    font-size: 11px; opacity: 0.7; line-height: 1;
  }
  .msg-ticks { font-size: 14px; line-height: 1; }
  .msg-link { color: inherit; text-decoration: underline; word-break: break-all; }
  .msg-image {
    display: block; max-width: 240px; max-height: 280px;
    border-radius: 8px; margin-bottom: 4px;
  }
  .msg-file {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 0; color: inherit; text-decoration: none;
  }
  .msg-file__name { font-weight: 600; font-size: 13px; }
  .msg-file__size { font-size: 11px; opacity: 0.75; }
  .msg-audio { width: min(240px, 100%); margin: 4px 0; }
  .msg-sender {
    font-size: 12px; font-weight: 600;
    color: var(--color-accent); margin-bottom: 2px;
  }
  .msg-reply {
    display: flex; gap: 8px; margin-bottom: 6px;
    padding: 4px 0; opacity: 0.9;
  }
  .msg-reply__bar {
    width: 3px; border-radius: 2px;
    background: var(--color-accent); flex-shrink: 0;
  }
  .msg-reply__name { font-size: 12px; font-weight: 600; }
  .msg-reply__text {
    font-size: 12px; opacity: 0.85;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;
  }
  .msg-day {
    display: flex; justify-content: center;
    margin: 12px 0 8px; clear: both;
  }
  .msg-day span {
    font-size: 12px; padding: 4px 12px; border-radius: 8px;
    background: var(--surface-2); color: var(--text-secondary);
  }
  #messages-list, .messages-list {
    display: flex; flex-direction: column; gap: 3px;
  }
`;

export default {
  renderMessage,
  renderMessageList,
  renderMessageListWithDays,
  daySeparatorHtml,
  MESSAGE_CSS,
};