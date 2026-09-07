import { ADMIN_EMAILS, ADMIN_NAME, VERIFIED_EMAILS, VERIFIED_NAME, db } from "./firebase-config.js";
import { doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onSnapshotWithRetry } from "./realtime-retry.js";

const toastEl = document.getElementById("toast");
let toastTimer = null;
let toastDetailsId = 0;

export function showToast(message, { details, duration = 3200 } = {}) {
  clearTimeout(toastTimer);
  toastEl.innerHTML = "";
  toastEl.classList.toggle("has-details", !!details);

  const msgSpan = document.createElement("span");
  msgSpan.className = "toast-msg";
  msgSpan.textContent = message;
  toastEl.appendChild(msgSpan);

  if (details) {
    const detailsId = `toast-details-${++toastDetailsId}`;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "toast-details-toggle";
    toggle.textContent = "Details";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", detailsId);

    const detailsEl = document.createElement("div");
    detailsEl.id = detailsId;
    detailsEl.className = "toast-details hidden";
    detailsEl.textContent = details;

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const nowHidden = detailsEl.classList.toggle("hidden");
      toggle.setAttribute("aria-expanded", String(!nowHidden));
      toggle.textContent = nowHidden ? "Details" : "Hide details";
      clearTimeout(toastTimer);
      if (nowHidden) toastTimer = setTimeout(() => toastEl.classList.remove("toast-show"), duration);
    });

    toastEl.appendChild(toggle);
    toastEl.appendChild(detailsEl);
  }

  toastEl.classList.add("toast-show");
  toastTimer = setTimeout(() => toastEl.classList.remove("toast-show"), duration);
}

const FRIENDLY_ERROR_MESSAGES = {
  "permission-denied": "You don't have permission to do that.",
  "unauthenticated": "You've been signed out — please log in again.",
  "unavailable": "Can't reach the server right now. Check your connection and try again.",
  "failed-precondition": "That couldn't be completed right now. Please try again in a moment.",
  "not-found": "That couldn't be found — it may have been removed.",
  "already-exists": "That already exists.",
  "resource-exhausted": "Too many requests right now — please try again shortly.",
  "cancelled": "That was interrupted before it finished. Please try again.",
  "deadline-exceeded": "That took too long to respond. Please try again.",
  "aborted": "That couldn't be completed — please try again.",
  "internal": "Something went wrong on our end. Please try again.",
  "invalid-argument": "Something about that request wasn't valid.",
  "out-of-range": "Something about that request wasn't valid.",
  "data-loss": "Something went wrong loading that data. Please try again.",
};

export function friendlyError(err, fallback = "Something went wrong. Please try again.") {
  const code = err?.code ? String(err.code).replace(/^firestore\//, "") : "";
  const technical = err ? [err.code, err.message].filter(Boolean).join(" — ") || String(err) : "";
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { message: "You're offline — this will work again once you're back online.", technical };
  }
  return { message: FRIENDLY_ERROR_MESSAGES[code] || fallback, technical };
}

const modalOverlay = document.getElementById("modal-overlay");
const modalBody = document.getElementById("modal-body");
const modalScroll = document.getElementById("modal-scroll");
const modalCloseBtn = document.getElementById("modal-close-btn");

let modalHistoryOpen = false;  
let closingFromPopstate = false; 
let modalClosable = true;    
export function openModal(html, { closable = true } = {}) {
  const wasHidden = modalOverlay.classList.contains("hidden");
  modalBody.innerHTML = html;
  if (modalScroll) modalScroll.scrollTop = 0; 
  modalClosable = closable;
  modalOverlay.classList.toggle("no-close", !closable);
  modalOverlay.classList.remove("hidden");
  if (wasHidden) {
    history.pushState({ leafmashModal: true }, "");
    modalHistoryOpen = true;
  }
}

export function closeModal({ force = false, keepHistory = false } = {}) {
  if (modalOverlay.classList.contains("hidden")) return;
  if (!modalClosable && !force) return;
  modalOverlay.classList.add("hidden");
  modalOverlay.classList.remove("no-close");
  modalBody.innerHTML = "";
  modalClosable = true;
  if (modalHistoryOpen) {
    modalHistoryOpen = false;
    if (!closingFromPopstate && !keepHistory) history.back(); 
  }
}

modalCloseBtn.addEventListener("click", () => closeModal());

window.addEventListener("popstate", () => {
  if (modalOverlay.classList.contains("hidden")) return;
  if (!modalClosable) {
    history.pushState({ leafmashModal: true }, "");
    return;
  }
  closingFromPopstate = true;
  closeModal();
  closingFromPopstate = false;
});

document.addEventListener("wheel", (e) => {
  const row = e.target.closest?.(".chip-row");
  if (!row || row.scrollWidth <= row.clientWidth) return;
  if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return; 
  e.preventDefault();
  row.scrollLeft += e.deltaY;
}, { passive: false });

export function skeletonRowsHtml(count = 3) {
  const row = `
    <div class="skeleton-row" aria-hidden="true">
      <div class="skeleton-avatar"></div>
      <div class="skeleton-head-lines"><div class="skeleton-line sk-70"></div><div class="skeleton-line sk-40"></div></div>
    </div>`;
  return row.repeat(count);
}

export function escapeHtml(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export function escapeAttr(str = "") {
  return escapeHtml(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const SOCIAL_LINK_ICONS = [
  { key: "facebook", match: /facebook\.com|fb\.com/i, label: "Facebook", svg: `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M13.5 21v-7.9h2.65l.4-3.08h-3.05V8.05c0-.89.25-1.5 1.52-1.5h1.63V3.8A21.8 21.8 0 0 0 14.3 3.7c-2.44 0-4.11 1.49-4.11 4.22v2.1H7.5v3.08h2.69V21h3.31z"/></svg>` },
  { key: "instagram", match: /instagram\.com/i, label: "Instagram", svg: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1"/></svg>` },
  { key: "x", match: /twitter\.com|x\.com/i, label: "X", svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.9 2.6h3.3l-7.2 8.2 8.5 11.2h-6.6l-5.2-6.8-6 6.8H2.4l7.7-8.8L1.9 2.6h6.8l4.7 6.2 5.5-6.2zm-1.2 17.4h1.8L7.3 4.4H5.4l12.3 15.6z"/></svg>` },
  { key: "linkedin", match: /linkedin\.com/i, label: "LinkedIn", svg: `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M6.94 8.5H3.56V20.4h3.38V8.5zM5.25 3.6a1.96 1.96 0 1 0 0 3.92 1.96 1.96 0 0 0 0-3.92zM20.4 20.4h-3.37v-6.15c0-1.47-.03-3.36-2.05-3.36-2.05 0-2.37 1.6-2.37 3.25v6.26H9.24V8.5h3.24v1.63h.05c.45-.86 1.56-1.77 3.2-1.77 3.42 0 4.05 2.25 4.05 5.18v6.86z"/></svg>` },
  { key: "youtube", match: /youtube\.com|youtu\.be/i, label: "YouTube", svg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22 12s0-3.4-.44-5a3 3 0 0 0-2.1-2.1C17.9 4.5 12 4.5 12 4.5s-5.9 0-7.46.4A3 3 0 0 0 2.44 7C2 8.6 2 12 2 12s0 3.4.44 5a3 3 0 0 0 2.1 2.1c1.56.4 7.46.4 7.46.4s5.9 0 7.46-.4a3 3 0 0 0 2.1-2.1C22 15.4 22 12 22 12zM10 15.5v-7l6 3.5-6 3.5z"/></svg>` },
  { key: "github", match: /github\.com/i, label: "GitHub", svg: `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.5c.5.1.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.15-1.11-1.46-1.11-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>` },
  { key: "whatsapp", match: /wa\.me|whatsapp\.com/i, label: "WhatsApp", svg: `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.06-1.33A10 10 0 1 0 12 2zm0 18.2a8.13 8.13 0 0 1-4.15-1.14l-.3-.18-3.02.8.8-2.94-.19-.3A8.18 8.18 0 1 1 12 20.2zm4.48-6.13c-.24-.12-1.43-.7-1.65-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.17-.7-.63-1.18-1.4-1.31-1.64-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.8-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02s.87 2.35.99 2.51c.12.16 1.71 2.6 4.14 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.15-.06-.1-.22-.16-.46-.28z"/></svg>` },
  { key: "telegram", match: /t\.me|telegram\.me|telegram\.org/i, label: "Telegram", svg: `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M21.5 3.5 2.9 10.8c-1.2.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.5c.2.6.4.9.9.9.4 0 .6-.2.9-.5l2.1-2 4.4 3.2c.8.5 1.4.2 1.6-.7l2.9-13.6c.3-1.2-.4-1.7-1.5-1.1zM8.3 13.4l9-5.6c.4-.3.8-.1.5.2l-7.5 6.8-.3 3-1.4-4.4z"/></svg>` },
  { key: "tiktok", match: /tiktok\.com/i, label: "TikTok", svg: `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M16.5 2h-3v13.6a2.6 2.6 0 1 1-2-2.53V9.9a5.9 5.9 0 1 0 5 5.83V9.1a7.9 7.9 0 0 0 4.5 1.4V7.3a4.9 4.9 0 0 1-4.5-4.4V2z"/></svg>` },
];
const SOCIAL_LINK_ICON_DEFAULT = { key: "link", label: "Link", svg: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.4l2-2a5 5 0 0 0-7-7l-1.2 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.4l-2 2a5 5 0 0 0 7 7l1.1-1.1"/></svg>` };

export function socialLinkIconHtml(url) {
  const entry = SOCIAL_LINK_ICONS.find(({ match }) => match.test(url)) || SOCIAL_LINK_ICON_DEFAULT;
  return `<a class="profile-social-icon-btn sc-${entry.key}" href="${escapeAttr(url)}" target="_blank" rel="noopener" aria-label="${entry.label} link">${entry.svg}</a>`;
}

export function initialsOf(name = "?") {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "?";
}


const AVATAR_PALETTE = [
  "#e11d48", "#db2777", "#c026d3", "#9333ea", "#7c3aed",
  "#4f46e5", "#2563eb", "#0ea5e9", "#0891b2", "#0d9488",
  "#059669", "#65a30d", "#ca8a04", "#d97706", "#ea580c", "#dc2626"
];

function hashSeed(seed = "") {
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = (h * 31 + seed.charCodeAt(i)) >>> 0; }
  return h;
}

export function avatarColorFor(seed) {
  if (!seed) return AVATAR_PALETTE[0];
  return AVATAR_PALETTE[hashSeed(String(seed)) % AVATAR_PALETTE.length];
}

function genderIconSvg(gender) {
  const body = `<path d="M12 14.5c-4.53 0-10.05 2.07-10.05 6.25V22h20.1v-1.25c0-4.18-5.52-6.25-10.05-6.25Z" fill="rgba(255,255,255,0.97)"/>`;

  if (gender === "male") {
    return `<svg viewBox="0 0 24 24" width="60%" height="60%" aria-hidden="true">
      <circle cx="12" cy="7.65" r="4.55" fill="rgba(255,255,255,0.5)"/>
      <circle cx="12" cy="8.3" r="4" fill="rgba(255,255,255,0.97)"/>
      ${body}
    </svg>`;
  }

  if (gender === "female") {
    return `<svg viewBox="0 0 24 24" width="60%" height="60%" aria-hidden="true">
      <path d="M17.55 13.75c1.75.98 2.9 2.6 3.15 4.55.25-1.55.06-2.98-.55-4.15-.75.02-1.6-.13-2.6-.4Z" fill="rgba(255,255,255,0.97)"/>
      <path d="M6.45 13.75c-1.75.98-2.9 2.6-3.15 4.55-.25-1.55-.06-2.98.55-4.15.75.02 1.6-.13 2.6-.4Z" fill="rgba(255,255,255,0.97)"/>
      <circle cx="12" cy="8.35" r="5.6" fill="rgba(255,255,255,0.97)"/>
      <circle cx="12" cy="9.05" r="3.7" fill="rgba(255,255,255,0.72)"/>
      ${body}
    </svg>`;
  }

  return `<svg viewBox="0 0 24 24" width="60%" height="60%" aria-hidden="true">
    <circle cx="12" cy="7.65" r="4.4" fill="rgba(255,255,255,0.97)"/>
    <circle cx="12" cy="4.55" r="1.15" fill="rgba(255,255,255,0.55)"/>
    ${body}
  </svg>`;
}

export function avatarInner(profile = {}) {
  const seed = profile.uid || profile.name || "?";
  const color = avatarColorFor(seed);
  if (profile.photoURL) {
    return `<span class="avatar-fill" style="background:${color}"><img src="${escapeAttr(profile.photoURL)}" alt="" loading="lazy" /></span>`;
  }
  return `<span class="avatar-fill" style="background:${color}">${genderIconSvg(profile.gender)}</span>`;
}

export function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(email);
}

export function adminBadgeHtml() {
  return `<svg class="admin-badge" viewBox="0 0 24 24" role="img" aria-label="Verified Admin" aria-hidden="false"><title>Founder & Admin</title><path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12z"/><text x="12" y="15.7" text-anchor="middle" font-size="10" font-weight="800" fill="#fff" font-family="Arial, Helvetica, sans-serif">A</text></svg>`;
}

export function isVerifiedEmail(email) {
  return !!email && VERIFIED_EMAILS.includes(email);
}

export function verifiedBadgeHtml() {
  return `<svg class="verified-badge" viewBox="0 0 24 24" role="img" aria-label="Verified LeafMash Account" aria-hidden="false"><title>Official LeafMash Account</title><path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12z"/><path d="M8.6 12.3l2.2 2.2 4.6-4.7" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function nameWithBadge(name, email, uid) {
  const admin = isAdminEmail(email);
  const officialVerified = !admin && isVerifiedEmail(email);
  const displayName = admin ? ADMIN_NAME : officialVerified ? VERIFIED_NAME : (name || "Classmate");
  if (admin) return `${escapeHtml(displayName)}${adminBadgeHtml()}`;
  if (officialVerified) return `${escapeHtml(displayName)}${verifiedBadgeHtml()}`;
  if (hasVerifiedBadge(uid)) return `${escapeHtml(displayName)}${verifiedBadgeHtml()}`;
  return escapeHtml(displayName);
}

export function timeAgo(timestamp) {
  if (!timestamp || !timestamp.toDate) return "just now";
  const seconds = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return timestamp.toDate().toLocaleDateString();
}

export function fullDate(timestamp) {
  if (!timestamp || !timestamp.toDate) return "";
  return timestamp.toDate().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

const spinnerHtml = `<span class="btn-spinner" aria-hidden="true"></span>`;

export function setBtnLoading(btn, loading, label) {
  if (!btn) return;
  if (loading) {
    if (btn.dataset.originalHtml === undefined) btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add("is-loading");
    btn.innerHTML = `${spinnerHtml}<span class="btn-spinner-label">${label || "Please wait…"}</span>`;
  } else {
    btn.disabled = false;
    btn.classList.remove("is-loading");
    if (btn.dataset.originalHtml !== undefined) {
      btn.innerHTML = btn.dataset.originalHtml;
      delete btn.dataset.originalHtml;
    }
  }
}

export function wireCharCounter(field, limit) {
  if (!field) return;
  field.maxLength = limit;
  let counter = field.nextElementSibling;
  if (!counter || !counter.classList.contains("char-counter")) {
    counter = document.createElement("div");
    counter.className = "char-counter";
    field.insertAdjacentElement("afterend", counter);
  }
  const update = () => {
    const len = field.value.length;
    counter.textContent = `${len}/${limit}`;
    counter.classList.toggle("char-counter-warn", len >= limit * 0.9);
  };
  field.addEventListener("input", update);
  update();
}

const userCache = new Map();
const profileListeners = new Set();
const subscribedProfiles = new Set();

const verifiedUidsDynamic = new Set();

export function cacheUserProfile(uid, profile) {
  if (!uid || !profile) return;
  userCache.set(uid, profile);
  if (profile.verified) verifiedUidsDynamic.add(uid);
  else verifiedUidsDynamic.delete(uid);
  profileListeners.forEach(cb => cb(uid));
}

export function hasVerifiedBadge(uid) {
  return !!uid && verifiedUidsDynamic.has(uid);
}

export function getCachedProfile(uid) {
  return userCache.get(uid) || null;
}


export function subscribeToProfileUpdates(callback) {
  profileListeners.add(callback);
  return () => profileListeners.delete(callback);
}

export function ensureProfileLoaded(uid) {
  if (!uid || subscribedProfiles.has(uid)) return;
  subscribedProfiles.add(uid);
  onSnapshotWithRetry(doc(db, "users", uid), (snap) => {
    if (snap.exists()) cacheUserProfile(uid, snap.data());
  }, () => {  });
}

export function attachClampToggle(container) {
  container.querySelectorAll(".clamp-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const textEl = btn.previousElementSibling;
      const expanded = textEl.classList.toggle("expanded");
      btn.textContent = expanded ? "See less" : "See more";
    });
  });
}

export function clampableHtml(rawText, extraClass = "") {
  const safe = escapeHtml(rawText);
  const isLong = rawText.length > 260;
  return `<p class="clampable ${extraClass} ${isLong ? "is-clampable" : ""}">${safe}</p>${isLong ? `<button type="button" class="clamp-toggle"> See more</button>` : ""}`;
}

const HASHTAG_RE = /#([A-Za-z0-9_\u0980-\u09FF]{2,40})/g;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractHashtags(rawText = "") {
  const found = new Set();
  for (const m of rawText.matchAll(HASHTAG_RE)) found.add(m[1].toLowerCase());
  return [...found];
}

export function richTextHtml(rawText, mentions = []) {
  let safe = escapeHtml(rawText);

  const uniqueMentions = [...new Map((mentions || []).filter(m => m && m.uid && m.name).map(m => [m.uid, m])).values()]
    .sort((a, b) => b.name.length - a.name.length);
  uniqueMentions.forEach((m) => {
    const escapedName = escapeHtml(m.name);
    const re = new RegExp(`@${escapeRegExp(escapedName)}(?=\\s|$|[.,!?;:)])`, "g");
    safe = safe.replace(re, `<button type="button" class="mention-chip" data-mention-uid="${escapeHtml(m.uid)}">@${escapedName}</button>`);
  });

  safe = safe.replace(HASHTAG_RE, (whole, tag) =>
    `<button type="button" class="hashtag-chip" data-hashtag="${tag.toLowerCase()}">#${tag}</button>`);

  return safe;
}

export function clampableRichHtml(rawText, mentions = [], extraClass = "") {
  const html = richTextHtml(rawText, mentions);
  const isLong = rawText.length > 260;
  return `<p class="clampable ${extraClass} ${isLong ? "is-clampable" : ""}">${html}</p>${isLong ? `<button type="button" class="clamp-toggle"> See more</button>` : ""}`;
}

export function wireRichTextClicks(root) {
  root.querySelectorAll(".mention-chip").forEach((btn) => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const { openUserProfilePage } = await import("./profile-view.js");
      openUserProfilePage(btn.dataset.mentionUid);
    });
  });
  root.querySelectorAll(".hashtag-chip").forEach((btn) => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const { openHashtagResults } = await import("./wall.js");
      openHashtagResults(btn.dataset.hashtag);
    });
  });
}

export function wireMentionAutocomplete(fieldEl, getCandidates, onPick) {
  if (!fieldEl || fieldEl.dataset.mentionWired) return;
  fieldEl.dataset.mentionWired = "1";

  const dropdown = document.createElement("div");
  dropdown.className = "mention-dropdown hidden";
  document.body.appendChild(dropdown);

  function reposition() {
    const rect = fieldEl.getBoundingClientRect();
    const bottomClearance = 92;
    const dropdownHeight = Math.min(dropdown.scrollHeight || 220, 220);
    const spaceBelow = window.innerHeight - rect.bottom - bottomClearance;
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight + 12;

    dropdown.style.left = `${rect.left}px`;
    dropdown.style.width = `${rect.width}px`;
    if (openUpward) {
      dropdown.style.top = "";
      dropdown.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    } else {
      dropdown.style.bottom = "";
      dropdown.style.top = `${rect.bottom + 4}px`;
    }
  }

  let activeIndex = -1;
  let currentMatches = [];

  function currentTrigger() {
    const value = fieldEl.value;
    const caret = fieldEl.selectionStart ?? value.length;
    const match = value.slice(0, caret).match(/(?:^|\s)@([^\s@]{0,30})$/);
    return match ? match[1] : null;
  }

  function close() {
    dropdown.classList.add("hidden");
    dropdown.innerHTML = "";
    currentMatches = [];
    activeIndex = -1;
  }

  function pick(candidate) {
    const value = fieldEl.value;
    const caret = fieldEl.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([^\s@]{0,30})$/, `@${candidate.name} `);
    fieldEl.value = before + value.slice(caret);
    const newCaret = before.length;
    fieldEl.focus();
    fieldEl.setSelectionRange(newCaret, newCaret);
    close();
    onPick(candidate);
  }

  function paintActive() {
    dropdown.querySelectorAll(".mention-option").forEach((btn, i) => {
      btn.classList.toggle("active", i === activeIndex);
    });
  }

  function open(query) {
    currentMatches = (getCandidates(query) || []).slice(0, 6);
    if (!currentMatches.length) { close(); return; }
    activeIndex = 0;
    dropdown.innerHTML = currentMatches.map((m, i) =>
      `<button type="button" class="mention-option ${i === 0 ? "active" : ""}" data-index="${i}">
        <span class="avatar avatar-sm">${avatarInner(m)}</span>
        <span>${escapeHtml(m.name || "Classmate")}</span>
      </button>`
    ).join("");
    dropdown.classList.remove("hidden");
    reposition();
    dropdown.querySelectorAll(".mention-option").forEach((btn, i) => {
      btn.addEventListener("mousedown", (e) => { e.preventDefault(); pick(currentMatches[i]); });
      btn.addEventListener("mouseenter", () => { activeIndex = i; paintActive(); });
    });
  }

  fieldEl.addEventListener("input", () => {
    const q = currentTrigger();
    if (q === null) { close(); return; }
    open(q);
  });
  fieldEl.addEventListener("blur", () => setTimeout(close, 120));
  fieldEl.addEventListener("keydown", (e) => {
    if (dropdown.classList.contains("hidden")) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % currentMatches.length;
      paintActive();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + currentMatches.length) % currentMatches.length;
      paintActive();
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (currentMatches[activeIndex]) {
        e.preventDefault();
        pick(currentMatches[activeIndex]);
      }
    }
  });
  window.addEventListener("resize", () => { if (!dropdown.classList.contains("hidden")) reposition(); });
  window.addEventListener("scroll", () => { if (!dropdown.classList.contains("hidden")) reposition(); }, true);

  const cleanupObserver = new MutationObserver(() => {
    if (!document.body.contains(fieldEl)) {
      dropdown.remove();
      cleanupObserver.disconnect();
    }
  });
  cleanupObserver.observe(document.body, { childList: true, subtree: true });
}

export function kebabMenuHtml(id, actions, extraClass = "") {
  return `
    <div class="kebab-menu ${extraClass}" data-kebab-id="${escapeHtml(String(id))}">
      <button type="button" class="kebab-btn" aria-label="More options" aria-haspopup="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>
      </button>
      <div class="kebab-dropdown hidden">
        ${actions.map(a => `<button type="button" class="kebab-item ${a.danger ? "danger" : ""}" data-kebab-action="${escapeHtml(a.action)}">${escapeHtml(a.label)}</button>`).join("")}
      </div>
    </div>`;
}

export function closeAllKebabMenus() {
  document.querySelectorAll(".kebab-dropdown").forEach(d => d.classList.add("hidden"));
  document.querySelectorAll(".kebab-stack-top").forEach(el => el.classList.remove("kebab-stack-top"));
}
document.addEventListener("click", closeAllKebabMenus);

export function wireKebabMenus(root, handlers) {
  root.querySelectorAll(".kebab-menu").forEach(menu => {
    const btn = menu.querySelector(".kebab-btn");
    const dd = menu.querySelector(".kebab-dropdown");
    if (!btn || !dd || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    const stackHost = menu.closest(".notice-row, .feed-post, .resource-row, .comment-item, .directory-row, .dm-thread-header-row") || menu;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wasHidden = dd.classList.contains("hidden");
      closeAllKebabMenus();
      if (wasHidden) {
        dd.classList.remove("hidden");
        stackHost.classList.add("kebab-stack-top");
      }
    });
    dd.querySelectorAll(".kebab-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllKebabMenus();
        const action = item.dataset.kebabAction;
        handlers[action]?.(menu.dataset.kebabId);
      });
    });
  });
}

export function confirmDialog({ title, text, confirmLabel = "Delete", danger = true, onConfirm }) {
  openModal(`
    <div class="confirm-modal">
      <div class="confirm-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </div>
      <h3>${escapeHtml(title)}</h3>
      <p class="confirm-text">${escapeHtml(text)}</p>
      <div class="confirm-actions">
        <button type="button" class="btn-outline full" id="confirm-cancel-btn">Cancel</button>
        <button type="button" class="btn-primary full ${danger ? "danger-solid" : ""}" id="confirm-ok-btn">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `);
  document.getElementById("confirm-cancel-btn").addEventListener("click", () => closeModal());
  const okBtn = document.getElementById("confirm-ok-btn");
  okBtn.addEventListener("click", async () => {
    setBtnLoading(okBtn, true, "Please wait…");
    try {
      await onConfirm();
      closeModal();
    } catch (err) {
      const { message, technical } = friendlyError(err);
      showToast(message, { details: technical });
      setBtnLoading(okBtn, false);
    }
  });
}

export function resetScrollForTabs(anchorEl) {
  if (!anchorEl) return;
  const topbar = document.querySelector(".topbar");
  const offset = (topbar?.offsetHeight || 0) + 10;
  const top = anchorEl.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(top, 0), behavior: "auto" });
}
