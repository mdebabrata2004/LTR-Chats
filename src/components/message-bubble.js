/**
 * Message bubble — single message HTML
 * Works with chat/message-renderer list helpers
 */

import { formatMessageTime, isWithin24Hours } from "../utils/date.js";
import { reactionsHtml } from "../chat/reactions.js";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkify(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a class="msg-link" href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

/**
 * @typedef {object} BubbleMessage
 * @property {string} id
 * @property {string} senderId
 * @property {string} [text]
 * @property {string} [type] text|image|file|audio|video
 * @property {boolean} [deleted]
 * @property {*} [createdAt]
 * @property {string} [mediaURL]
 * @property {string} [fileName]
 * @property {string} [fileSizeLabel]
 * @property {object} [reactions]
 * @property {object} [replyTo]
 */

/**
 * Render one bubble
 * @param {BubbleMessage} msg
 * @param {string} meUid
 * @param {{ showSender?: boolean, senderName?: string }} [opts]
 */
export function messageBubbleHtml(msg, meUid, opts = {}) {
  if (!msg?.id) return "";

  const isOut = msg.senderId === meUid;
  const side = isOut ? "out" : "in";
  const type = msg.type || "text";

  if (msg.deleted === true) {
    return `
      <div class="msg deleted ${side}" data-mid="${escapeHtml(msg.id)}" data-type="deleted">
        <span class="msg-deleted-label">
          <i class="bi bi-slash-circle"></i> This message was deleted
        </span>
      </div>
    `;
  }

  const time = msg.createdAt ? formatMessageTime(msg.createdAt) : "";
  const canDelete = isOut && isWithin24Hours(msg.createdAt);

  let body = "";
  if (type === "image" && msg.mediaURL) {
    body = `
      <a class="msg-media" href="${escapeHtml(msg.mediaURL)}" target="_blank" rel="noopener">
        <img class="msg-image" src="${escapeHtml(msg.mediaURL)}" alt="Image" loading="lazy" />
      </a>
      ${msg.text ? `<div class="msg-body">${linkify(msg.text)}</div>` : ""}
    `;
  } else if ((type === "file" || type === "video") && msg.mediaURL) {
    const name = escapeHtml(msg.fileName || (type === "video" ? "Video" : "File"));
    const size = msg.fileSizeLabel ? escapeHtml(msg.fileSizeLabel) : "";
    body = `
      <a class="msg-file" href="${escapeHtml(msg.mediaURL)}" target="_blank" rel="noopener">
        <i class="bi bi-${type === "video" ? "camera-video" : "file-earmark"}"></i>
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
    body = `<div class="msg-body">${linkify(msg.text || "")}</div>`;
  }

  let reply = "";
  if (msg.replyTo && (msg.replyTo.text || msg.replyTo.id)) {
    reply = `
      <div class="msg-reply">
        <div class="msg-reply__bar"></div>
        <div class="msg-reply__content">
          ${
            msg.replyTo.senderName
              ? `<div class="msg-reply__name">${escapeHtml(msg.replyTo.senderName)}</div>`
              : ""
          }
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
 * Optional standalone bubble styles (if not using chat-view MESSAGE_CSS)
 */
export const BUBBLE_CSS = `
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
    background: var(--bubble-out, #d9fdd3);
    color: var(--bubble-out-text, #111b21);
    border-bottom-right-radius: 4px;
  }
  .msg.in {
    align-self: flex-start;
    background: var(--bubble-in, #fff);
    color: var(--bubble-in-text, #111b21);
    border-bottom-left-radius: 4px;
  }
  .msg.deleted { opacity: 0.7; font-style: italic; box-shadow: none; }
  .msg-deleted-label {
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .msg-body { white-space: pre-wrap; }
  .msg-meta {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    float: right;
    margin: 2px 0 0 12px;
    font-size: 11px;
    opacity: 0.7;
    line-height: 1;
  }
  .msg-ticks { font-size: 14px; }
  .msg-link { color: inherit; text-decoration: underline; word-break: break-all; }
  .msg-image {
    display: block;
    max-width: 240px;
    max-height: 280px;
    border-radius: 8px;
    margin-bottom: 4px;
  }
  .msg-file {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    color: inherit;
    text-decoration: none;
  }
  .msg-file__name { font-weight: 600; font-size: 13px; }
  .msg-file__size { font-size: 11px; opacity: 0.75; }
  .msg-audio { width: min(240px, 100%); margin: 4px 0; }
  .msg-sender {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-accent, #5b6af0);
    margin-bottom: 2px;
  }
  .msg-reply {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
    opacity: 0.9;
  }
  .msg-reply__bar {
    width: 3px;
    border-radius: 2px;
    background: var(--color-accent, #5b6af0);
    flex-shrink: 0;
  }
  .msg-reply__name { font-size: 12px; font-weight: 600; }
  .msg-reply__text {
    font-size: 12px;
    opacity: 0.85;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }
`;

export default {
  messageBubbleHtml,
  BUBBLE_CSS,
};