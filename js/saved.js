import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getSavedResources, getSavedPostIds, addBookmarksListener, removeBookmarksListener } from "./bookmarks.js";
import { renderResourceRows } from "./resources.js";

let mountedListEl = null;
let activeFilter = "all";
let renderToken = 0;

function shellHtml() {
  return `
    <div class="chip-row saved-filter-row">
      <button type="button" class="chip ${activeFilter === "all" ? "active" : ""}" data-filter="all">All</button>
      <button type="button" class="chip ${activeFilter === "posts" ? "active" : ""}" data-filter="posts">Posts</button>
      <button type="button" class="chip ${activeFilter === "notes" ? "active" : ""}" data-filter="notes">Notes</button>
    </div>
    <div class="saved-items-list"></div>
  `;
}

export function mountSavedView(container) {
  if (!container) return;
  removeBookmarksListener(renderSavedView);
  mountedListEl = container;
  mountedListEl.innerHTML = shellHtml();
  wireFilterChips();
  addBookmarksListener(renderSavedView);
  renderSavedView();
}

export function unmountSavedView() {
  removeBookmarksListener(renderSavedView);
  mountedListEl = null;
}

function wireFilterChips() {
  mountedListEl.querySelectorAll(".saved-filter-row .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      if (chip.dataset.filter === activeFilter) return;
      activeFilter = chip.dataset.filter;
      mountedListEl.querySelectorAll(".saved-filter-row .chip").forEach(c => c.classList.toggle("active", c === chip));
      renderSavedView();
    });
  });
}

async function renderSavedView() {
  if (!mountedListEl) return;
  const itemsEl = mountedListEl.querySelector(".saved-items-list");
  if (!itemsEl) return;
  const token = ++renderToken;

  const savedResources = getSavedResources();

  if (activeFilter === "notes") {
    renderResourceRows(savedResources, itemsEl, "No saved notes yet — tap the bookmark icon on any note to save it for later.", { savedView: true });
    return;
  }

  const savedPostIds = getSavedPostIds();
  if (!savedPostIds.length) {
    if (activeFilter === "posts") {
      itemsEl.innerHTML = `<p class="empty-state">No saved posts yet — tap the bookmark icon on any post to save it for later.</p>`;
    } else if (!savedResources.length) {
      itemsEl.innerHTML = `<p class="empty-state">No saved items yet — tap the bookmark icon on any post or note to save it for later.</p>`;
    } else {
      renderResourceRows(savedResources, itemsEl, "", { savedView: true });
    }
    return;
  }

  itemsEl.innerHTML = `<div class="skeleton-row" aria-hidden="true"><div class="skeleton-avatar"></div><div class="skeleton-head-lines"><div class="skeleton-line sk-70"></div><div class="skeleton-line sk-40"></div></div></div>`;

  const { renderPost } = await import("./wall.js");
  const postSnaps = await Promise.all(savedPostIds.map(id => getDoc(doc(db, "posts", id))));
  if (token !== renderToken) return;
  const posts = postSnaps.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() }));

  if (activeFilter === "posts") {
    if (!posts.length) {
      itemsEl.innerHTML = `<p class="empty-state">No saved posts yet — tap the bookmark icon on any post to save it for later.</p>`;
      return;
    }
    itemsEl.innerHTML = `<div class="flat-list feed-list"></div>`;
    const feedListEl = itemsEl.querySelector(".feed-list");
    posts.forEach(post => renderPost(post.id, post, feedListEl, { onChanged: renderSavedView }));
    return;
  }

  if (!posts.length && !savedResources.length) {
    itemsEl.innerHTML = `<p class="empty-state">No saved items yet — tap the bookmark icon on any post or note to save it for later.</p>`;
    return;
  }

  itemsEl.innerHTML = posts.length ? `<div class="flat-list feed-list"></div>` : "";
  if (posts.length) {
    const feedListEl = itemsEl.querySelector(".feed-list");
    posts.forEach(post => renderPost(post.id, post, feedListEl, { onChanged: renderSavedView }));
  }
  if (savedResources.length) {
    const notesWrap = document.createElement("div");
    itemsEl.appendChild(notesWrap);
    renderResourceRows(savedResources, notesWrap, "", { savedView: true });
  }
}
