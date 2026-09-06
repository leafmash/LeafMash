import { db, auth } from "./firebase-config.js";
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  escapeHtml, escapeAttr, showToast, friendlyError, avatarInner, isAdminEmail, verifiedBadgeHtml, cacheUserProfile
} from "./ui-utils.js";

const searchInput = document.getElementById("admin-verified-search");
const listEl = document.getElementById("admin-verified-list");

let shellWired = false;
let allUsers = [];
let loaded = false;
let loading = false;

export function renderAdminVerifiedPage() {
  if (!listEl) return;

  const isAdmin = !!(auth.currentUser && isAdminEmail(auth.currentUser.email));
  if (!isAdmin) {
    listEl.innerHTML = `<p class="empty-state">Admins only.</p>`;
    return;
  }

  if (!shellWired) {
    shellWired = true;
    searchInput?.addEventListener("input", renderList);
  }
  loadUsers();
}

function loadUsers() {
  if (loading) return;
  loading = true;
  if (!loaded) listEl.innerHTML = `<p class="empty-state">Loading classmates…</p>`;
  getDocs(collection(db, "users")).then(snap => {
    allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    allUsers.forEach(u => cacheUserProfile(u.uid, u));
    loaded = true;
    loading = false;
    renderList();
  }).catch(err => {
    loading = false;
    const { message, technical } = friendlyError(err, "Couldn't load classmates.");
    listEl.innerHTML = `<p class="empty-state">Couldn't load classmates.</p>`;
    showToast(message, { details: technical });
  });
}

function renderList() {
  if (!listEl || !loaded) return;
  const term = (searchInput?.value || "").trim().toLowerCase();

  const filtered = term
    ? allUsers.filter(s =>
        (s.name || "").toLowerCase().includes(term) ||
        (s.roll || "").toLowerCase().includes(term))
    : allUsers.filter(s => s.verified);

  if (!filtered.length) {
    listEl.innerHTML = term
      ? `<p class="empty-state">No classmates match “${escapeHtml(searchInput.value.trim())}”.</p>`
      : `<p class="empty-state">No one has a verified badge yet. Search above to give one.</p>`;
    return;
  }

  listEl.innerHTML = `<div class="flat-list">` + filtered.map(s => `
    <div class="directory-row" data-uid="${escapeAttr(s.uid || "")}">
      <div class="avatar">${avatarInner(s)}</div>
      <div class="directory-info">
        <strong>${escapeHtml(s.name || "Unnamed")}${s.verified ? verifiedBadgeHtml() : ""}</strong>
        <div class="directory-sub">${escapeHtml(s.roll || "—")}${s.year ? " · " + escapeHtml(s.year) : ""}</div>
      </div>
      <label class="settings-toggle" title="${s.verified ? "Remove verified badge" : "Give verified badge"}">
        <input type="checkbox" data-verify-uid="${escapeAttr(s.uid || "")}" ${s.verified ? "checked" : ""} />
        <span class="switch-track"><span class="switch-thumb"></span></span>
      </label>
    </div>`).join("") + `</div>`;

  listEl.querySelectorAll("[data-verify-uid]").forEach(input => {
    input.addEventListener("change", async () => {
      const uid = input.dataset.verifyUid;
      const nextVerified = input.checked;
      input.disabled = true;
      try {
        await updateDoc(doc(db, "users", uid), { verified: nextVerified });
        const student = allUsers.find(s => s.uid === uid);
        if (student) {
          student.verified = nextVerified;
          cacheUserProfile(uid, student);
        }
        showToast(nextVerified ? "Verified badge given." : "Verified badge removed.");
        if (!term) renderList();
      } catch (err) {
        input.checked = !nextVerified;
        const { message, technical } = friendlyError(err, "Couldn't update the verified badge.");
        showToast(message, { details: technical });
      } finally {
        input.disabled = false;
      }
    });
  });
}
