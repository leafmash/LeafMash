import { db, auth } from "./firebase-config.js";
import {
  collection, doc, setDoc, deleteDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { onSnapshotWithRetry } from "./realtime-retry.js";

let bookmarkDocs = [];
let bookmarkedResourceIds = new Set();
let bookmarkedPostIds = new Set();
let unsubscribe = null;
const listeners = new Set();

export function initBookmarks() {
  if (unsubscribe) return;
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const q = query(collection(db, "users", uid, "bookmarks"), orderBy("savedAt", "desc"));
  unsubscribe = onSnapshotWithRetry(q, (snap) => {
    bookmarkDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    bookmarkedResourceIds = new Set(
      bookmarkDocs.filter(b => (b.type || "resource") === "resource").map(b => b.resourceId || b.id)
    );
    bookmarkedPostIds = new Set(
      bookmarkDocs.filter(b => b.type === "post").map(b => b.postId)
    );
    listeners.forEach(fn => fn());
  }, (err) => {
    console.warn("Couldn't load saved items:", err.message);
  });
}

export function teardownBookmarks() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  bookmarkDocs = [];
  bookmarkedResourceIds = new Set();
  bookmarkedPostIds = new Set();
  listeners.clear();
}

export function addBookmarksListener(fn) {
  listeners.add(fn);
}

export function removeBookmarksListener(fn) {
  listeners.delete(fn);
}

export function getSavedResources() {
  return bookmarkDocs
    .filter(b => (b.type || "resource") === "resource")
    .map(b => ({ ...b, id: b.resourceId || b.id }));
}

export function getSavedPostIds() {
  return bookmarkDocs.filter(b => b.type === "post").map(b => b.postId);
}

export function isResourceSaved(resId) {
  return bookmarkedResourceIds.has(resId);
}

export function isPostSaved(postId) {
  return bookmarkedPostIds.has(postId);
}

export async function toggleResourceBookmark(resId, alreadySaved, resource) {
  const uid = auth.currentUser?.uid;
  if (!uid || !resId) return;
  const ref = doc(db, "users", uid, "bookmarks", resId);
  if (alreadySaved) {
    await deleteDoc(ref);
    return;
  }
  if (!resource) return;
  await setDoc(ref, {
    type: "resource",
    resourceId: resId,
    title: resource.title,
    category: resource.category,
    link: resource.link,
    sourceType: resource.sourceType || null,
    fileExt: resource.fileExt || null,
    contributorName: resource.contributorName || null,
    savedAt: serverTimestamp()
  });
}

export async function togglePostBookmark(postId, alreadySaved) {
  const uid = auth.currentUser?.uid;
  if (!uid || !postId) return;
  const ref = doc(db, "users", uid, "bookmarks", `post_${postId}`);
  if (alreadySaved) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(ref, { type: "post", postId, savedAt: serverTimestamp() });
}
