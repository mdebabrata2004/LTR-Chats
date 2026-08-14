/**
 * People / Search — find users by username and start chat
 */

import { searchUsersByUsername, getOrCreateDirectConversation } from "../firebase/firestore.js";
import { navigate } from "../core/router.js";
import { debounce } from "../utils/debounce.js";
import { showToast } from "../components/toast.js";

export function renderPeople() {
  const root = document.getElementById("page-root");
  if (!root) return () => {};

  root.innerHTML = `
    <header class="app-header">
      <h1 class="app-header__title">People</h1>
    </header>
    <div style="padding:12px 16px">
      <input class="field__input" id="people-search" type="search" placeholder="Search by username (e.g. john)" autocomplete="off" />
    </div>
    <div class="page__scroll" id="people-results">
      <div class="empty-state">
        <div class="empty-state__title">Find people</div>
        <p class="empty-state__desc">Search by unique username to start a chat.</p>
      </div>
    </div>
  `;

  const input = document.getElementById("people-search");
  const results = document.getElementById("people-results");

  const doSearch = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) {
      results.innerHTML = `<div class="empty-state"><div class="empty-state__title">Find people</div><p class="empty-state__desc">Type at least 2 characters.</p></div>`;
      return;
    }
    results.innerHTML = `<div class="empty-state"><div class="loader"></div></div>`;
    try {
      const users = await searchUsersByUsername(q);
      if (!users.length) {
        results.innerHTML = `<div class="empty-state"><div class="empty-state__title">No results</div><p class="empty-state__desc">No user found for “${q}”</p></div>`;
        return;
      }
      results.innerHTML = users.map((u) => `
        <div class="list-row" data-uid="${u.uid}">
          <div class="avatar avatar--md">${u.photoURL ? `<img src="${u.photoURL}" alt="">` : (u.displayName || u.username || "?")[0].toUpperCase()}</div>
          <div class="list-row__content">
            <div class="list-row__title">${u.displayName || u.username}</div>
            <div class="list-row__subtitle">@${u.username || ""}</div>
          </div>
          <button class="btn btn--sm btn--primary" data-msg="${u.uid}">Message</button>
        </div>
      `).join("");

      results.querySelectorAll("[data-msg]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          btn.disabled = true;
          try {
            const cid = await getOrCreateDirectConversation(btn.dataset.msg);
            navigate(`chat/${cid}`);
          } catch (err) {
            showToast(err.message || "Could not start chat");
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      console.error(err);
      results.innerHTML = `<div class="empty-state"><div class="empty-state__title">Error</div><p class="empty-state__desc">${err.message}</p></div>`;
    }
  }, 350);

  input.addEventListener("input", doSearch);

  return () => {
    root.innerHTML = "";
  };
}

export default { renderPeople };