import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { escapeHtml } from "./ui-utils.js";

const CapApp = window.Capacitor?.Plugins?.App;
const AppUpdater = window.Capacitor?.Plugins?.AppUpdater;

function buildOverlay(cfg) {
  const overlay = document.createElement("div");
  overlay.className = "force-update-overlay";
  overlay.innerHTML = `
    <div class="force-update-card">
      <div class="force-update-icon">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3.5-7.1"/><path d="M21 3v6h-6"/></svg>
      </div>
      <h2>Update Required</h2>
      <p class="force-update-desc">A new version of LeafMash is available. Please update to keep using the app.</p>
      ${cfg.changelog ? `<p class="force-update-changelog">${escapeHtml(cfg.changelog)}</p>` : ""}
      <div class="force-update-progress" id="force-update-progress">
        <span class="force-update-progress-bar" id="force-update-progress-bar"></span>
      </div>
      <p class="force-update-status" id="force-update-status"></p>
      <button type="button" class="btn-primary full raised" id="force-update-btn">Update Now</button>
    </div>`;
  document.body.appendChild(overlay);
  return {
    button: overlay.querySelector("#force-update-btn"),
    progress: overlay.querySelector("#force-update-progress"),
    progressBar: overlay.querySelector("#force-update-progress-bar"),
    status: overlay.querySelector("#force-update-status")
  };
}

async function startDownload(apkUrl, els) {
  els.button.disabled = true;
  if (!AppUpdater) {
    window.open(apkUrl, "_system");
    els.status.textContent = "Opening the download link…";
    els.button.disabled = false;
    return;
  }
  els.progress.classList.add("show");
  els.status.textContent = "Downloading update…";
  const listener = await AppUpdater.addListener("downloadProgress", ({ percent }) => {
    els.progressBar.style.width = `${percent}%`;
    els.status.textContent = `Downloading update… ${percent}%`;
  });
  try {
    await AppUpdater.downloadAndInstall({ url: apkUrl });
    els.status.textContent = "Opening installer…";
  } catch (err) {
    if (err?.message === "install-permission-required") {
      els.status.textContent = "Please allow LeafMash to install apps, then tap Update Now again.";
    } else {
      els.status.textContent = "Couldn't download the update. Please check your connection and try again.";
    }
    els.button.disabled = false;
  } finally {
    listener.remove();
  }
}

function showForcedUpdateOverlay(cfg) {
  const els = buildOverlay(cfg);
  els.button.addEventListener("click", () => startDownload(cfg.apkUrl, els));
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(false), ms))
  ]);
}

async function runForcedUpdateCheck() {
  if (!CapApp || !window.Capacitor?.isNativePlatform?.()) return false;
  let info;
  try {
    info = await CapApp.getInfo();
  } catch {
    return false;
  }
  const currentBuild = parseInt(info.build, 10);
  if (!currentBuild) return false;

  let snap;
  try {
    snap = await getDoc(doc(db, "config", "appVersion"));
  } catch {
    return false;
  }
  if (!snap.exists()) return false;

  const cfg = snap.data();
  const minVersionCode = Number(cfg.minVersionCode) || 0;
  if (currentBuild >= minVersionCode || !cfg.apkUrl) return false;

  showForcedUpdateOverlay(cfg);
  return true;
}

export function checkForcedUpdate() {
  return withTimeout(runForcedUpdateCheck(), 4000);
}
