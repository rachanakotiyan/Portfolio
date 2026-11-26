/**
 * sound.js — Web Audio API pentatonic hover chime
 * Tweak SOUND_VOLUME (0–0.2) to adjust loudness.
 */
export const SOUND_VOLUME = 0.045;
const THROTTLE_MS = 125;
const STORAGE_KEY = "portfolio-sound";
const PENTATONIC = [293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25, 783.99];

let ctx = null;
let enabled = false;
let lastPlayed = 0;

function readPref() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function writePref(val) {
  try {
    localStorage.setItem(STORAGE_KEY, val ? "on" : "off");
  } catch {
    // ignore storage blocks
  }
}

function ensureContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function isSoundEnabled() {
  return enabled && !document.hidden;
}

export function initSoundToggle(button) {
  if (!button) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.innerWidth < 640;
  if (reduced || mobile) {
    enabled = false;
    button.setAttribute("aria-pressed", "false");
    button.textContent = "sound: off";
    return;
  }

  enabled = readPref();
  const sync = () => {
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    button.textContent = enabled ? "sound: on" : "sound: off";
  };
  sync();

  button.addEventListener("click", () => {
    enabled = !enabled;
    writePref(enabled);
    sync();
    if (enabled) {
      ensureContext();
      playMotifTone("sparkles", true);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden && ctx.state === "running") {
      ctx.suspend().catch(() => {});
    } else if (!document.hidden && enabled && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  });
}

export function playMotifTone(motifName, force = false) {
  if (!isSoundEnabled() && !force) return;
  const nowMs = performance.now();
  if (!force && nowMs - lastPlayed < THROTTLE_MS) return;
  lastPlayed = nowMs;

  const audio = ensureContext();
  if (!audio || audio.state !== "running") return;

  const now = audio.currentTime;
  const freq = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];

  const osc = audio.createOscillator();
  const gain = audio.createGain();

  // Timbre by motif family
  if (motifName === "notes" || motifName === "sun") {
    // Soft pluck
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(SOUND_VOLUME, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  } else if (motifName === "koi" || motifName === "wings") {
    // Airy tone
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * 0.75, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(SOUND_VOLUME * 0.85, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.58);
  } else {
    // Bell-like (mirrorball, star, galaxy, sparkles)
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    const overtone = audio.createOscillator();
    const overGain = audio.createGain();
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(freq * 2, now);
    overGain.gain.setValueAtTime(0.0001, now);
    overGain.gain.linearRampToValueAtTime(SOUND_VOLUME * 0.3, now + 0.012);
    overGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(SOUND_VOLUME, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc.connect(gain);
    overtone.connect(overGain);
    gain.connect(audio.destination);
    overGain.connect(audio.destination);
    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.48);
    overtone.stop(now + 0.28);
  }
}
