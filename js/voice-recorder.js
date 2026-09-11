import { escapeAttr, showToast } from "./ui-utils.js";

export const VOICE_MAX_SECONDS = 60;
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const WAVEFORM_BARS = 24;

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
}

export function isVoiceRecordingSupported() {
  return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

function formatClock(totalSec) {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function trashIconSvg() {
  return `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
}
function sendIconSvg() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
}
function playIconSvg() {
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`;
}
function pauseIconSvg() {
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
}

export function wireVoiceRecorder({ bar, micBtn, form, folder, onSend }) {
  if (!bar || !micBtn || !form) return;
  if (!isVoiceRecordingSupported()) {
    micBtn.classList.add("hidden");
    micBtn.dataset.unsupported = "1";
    return;
  }

  let mediaRecorder = null;
  let mediaStream = null;
  let chunks = [];
  let startMs = 0;
  let timerHandle = null;
  let audioCtx = null;
  let analyser = null;
  let rafHandle = null;
  let cancelled = false;
  let busy = false;

  bar.innerHTML = `
    <button type="button" class="chat-voice-cancel-btn" aria-label="Cancel recording">${trashIconSvg()}</button>
    <span class="chat-voice-dot" aria-hidden="true"></span>
    <div class="chat-voice-wave" aria-hidden="true">${Array.from({ length: WAVEFORM_BARS }).map(() => "<span></span>").join("")}</div>
    <span class="chat-voice-clock">0:00</span>
    <button type="button" class="chat-voice-send-btn" aria-label="Send voice message">${sendIconSvg()}</button>`;

  const cancelBtn = bar.querySelector(".chat-voice-cancel-btn");
  const sendBtn = bar.querySelector(".chat-voice-send-btn");
  const clockEl = bar.querySelector(".chat-voice-clock");
  const waveBars = Array.from(bar.querySelectorAll(".chat-voice-wave span"));

  function showBar(show) {
    bar.classList.toggle("hidden", !show);
    form.classList.toggle("hidden", show);
  }

  function tickClock() {
    const elapsed = (Date.now() - startMs) / 1000;
    clockEl.textContent = formatClock(elapsed);
    if (elapsed >= VOICE_MAX_SECONDS) stopRecording(false);
  }

  function animateWave() {
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    const level = Math.min(1, rms * 4.5);
    const idx = Math.floor(Date.now() / 90) % WAVEFORM_BARS;
    waveBars[idx]?.style.setProperty("--lvl", String(0.18 + level * 0.82));
    rafHandle = requestAnimationFrame(animateWave);
  }

  function teardownStream() {
    mediaStream?.getTracks().forEach((t) => t.stop());
    mediaStream = null;
    if (rafHandle) cancelAnimationFrame(rafHandle);
    rafHandle = null;
    analyser = null;
    if (audioCtx) audioCtx.close?.().catch(() => {});
    audioCtx = null;
    clearInterval(timerHandle);
    timerHandle = null;
  }

  async function startRecording() {
    if (mediaRecorder || busy) return;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showToast("Microphone access is needed to record a voice message.");
      return;
    }
    cancelled = false;
    chunks = [];
    const mimeType = pickMimeType();
    mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
    mediaRecorder.addEventListener("dataavailable", (e) => { if (e.data.size) chunks.push(e.data); });
    mediaRecorder.addEventListener("stop", handleStopped);
    mediaRecorder.start(250);
    startMs = Date.now();
    showBar(true);
    clockEl.textContent = "0:00";
    waveBars.forEach((b) => b.style.setProperty("--lvl", "0.18"));
    timerHandle = setInterval(tickClock, 250);

    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(mediaStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      animateWave();
    } catch {
      analyser = null;
    }
  }

  function stopRecording(wasCancelled) {
    if (!mediaRecorder || mediaRecorder.state === "inactive") return;
    cancelled = wasCancelled;
    mediaRecorder.stop();
  }

  function handleStopped() {
    const durationSec = (Date.now() - startMs) / 1000;
    const mimeType = mediaRecorder.mimeType || "audio/webm";
    const wasCancelled = cancelled;
    teardownStream();
    showBar(false);
    mediaRecorder = null;
    if (wasCancelled || durationSec < 1 || !chunks.length) {
      chunks = [];
      return;
    }
    const blob = new Blob(chunks, { type: mimeType });
    chunks = [];
    if (blob.size > MAX_AUDIO_BYTES) {
      showToast("That voice message is too long — please keep it under a minute.");
      return;
    }
    busy = true;
    Promise.resolve(onSend(blob, Math.min(VOICE_MAX_SECONDS, Math.round(durationSec)), folder))
      .catch(() => {})
      .finally(() => { busy = false; });
  }

  micBtn.addEventListener("click", startRecording);
  cancelBtn.addEventListener("click", () => stopRecording(true));
  sendBtn.addEventListener("click", () => stopRecording(false));
}

export function voiceBubbleHtml(m) {
  const dur = Number(m.audioDurationSec) || 0;
  return `
    <div class="voice-msg-player" data-voice-src="${escapeAttr(m.audioUrl)}">
      <button type="button" class="voice-msg-play-btn" aria-label="Play voice message">${playIconSvg()}</button>
      <div class="voice-msg-track"><div class="voice-msg-progress"></div></div>
      <span class="voice-msg-time">${formatClock(dur)}</span>
    </div>`;
}

function setPlayerState(playerEl, playing, ratio) {
  const btn = playerEl.querySelector(".voice-msg-play-btn");
  const track = playerEl.querySelector(".voice-msg-progress");
  if (btn) btn.innerHTML = playing ? pauseIconSvg() : playIconSvg();
  if (track) track.style.width = `${Math.max(0, Math.min(1, ratio || 0)) * 100}%`;
  playerEl.classList.toggle("is-playing", playing);
}

const audioRegistry = new WeakMap();
let currentlyPlayingEl = null;

function getAudioFor(playerEl) {
  let audio = audioRegistry.get(playerEl);
  if (audio) return audio;
  audio = new Audio(playerEl.dataset.voiceSrc);
  audio.preload = "none";
  audioRegistry.set(playerEl, audio);
  audio.addEventListener("timeupdate", () => {
    if (audio.duration) setPlayerState(playerEl, !audio.paused, audio.currentTime / audio.duration);
  });
  audio.addEventListener("ended", () => {
    setPlayerState(playerEl, false, 0);
    if (currentlyPlayingEl === playerEl) currentlyPlayingEl = null;
  });
  audio.addEventListener("pause", () => {
    if (!audio.ended) setPlayerState(playerEl, false, audio.duration ? audio.currentTime / audio.duration : 0);
  });
  return audio;
}

export function wireVoicePlayback(root) {
  root.querySelectorAll(".voice-msg-player").forEach((playerEl) => {
    if (playerEl.dataset.wired) return;
    playerEl.dataset.wired = "1";
    playerEl.querySelector(".voice-msg-play-btn")?.addEventListener("click", () => {
      const audio = getAudioFor(playerEl);
      if (currentlyPlayingEl && currentlyPlayingEl !== playerEl) {
        audioRegistry.get(currentlyPlayingEl)?.pause();
      }
      if (audio.paused) {
        audio.play().then(() => { currentlyPlayingEl = playerEl; }).catch(() => showToast("Couldn't play that voice message."));
      } else {
        audio.pause();
      }
    });
  });
}
