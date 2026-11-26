/**
 * motifCanvas.js — Renders individual MotifCanvas components.
 * Each motif lives in its own reserved bounding box so nothing ever overlaps.
 */
import { sampleMotif } from "../data/motifs/index.js";
import { playMotifTone } from "./sound.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

function readVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function toRgba(col, alpha) {
  if (!col) return `rgba(232,232,236,${alpha.toFixed(3)})`;
  if (col.startsWith("rgb")) {
    const m = col.match(/[\d.]+/g);
    if (m && m.length >= 3) return `rgba(${m[0]},${m[1]},${m[2]},${alpha.toFixed(3)})`;
  }
  let hex = col.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  }
  return col;
}

// Shared subtle pointer parallax state (lerped in each frame)
const globalPtr = { tx: 0, ty: 0, cx: 0, cy: 0 };
let ptrBound = false;
function bindGlobalPointer() {
  if (ptrBound) return;
  ptrBound = true;
  window.addEventListener(
    "pointermove",
    (e) => {
      globalPtr.tx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      globalPtr.ty = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    },
    { passive: true }
  );
}

export function initMotifCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const motifName = canvas.dataset.motif || "sparkles";
  const opacityScale = parseFloat(canvas.dataset.opacity || "1");
  const parallaxAmt = parseFloat(canvas.dataset.parallax || "5");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.innerWidth < 640;
  const staticMode = reduced || mobile;

  if (!staticMode) bindGlobalPointer();

  let w = 0;
  let h = 0;
  let dpr = 1;
  let fontMono = "";
  const colorCache = new Map();

  function refreshTokens() {
    fontMono = readVar("--mono") || "monospace";
    colorCache.clear();
  }

  function getColor(varName) {
    if (!colorCache.has(varName)) {
      colorCache.set(varName, readVar(varName));
    }
    return colorCache.get(varName);
  }

  function resize() {
    refreshTokens();
    dpr = window.devicePixelRatio || 1;
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Local hover state (inside this motif's box)
  let hoverX = -9999;
  let hoverY = -9999;
  let targetHoverStrength = 0;
  let hoverStrength = 0;
  let lastPtrMove = 0;

  if (!staticMode) {
    canvas.addEventListener(
      "pointermove",
      (e) => {
        const now = performance.now();
        if (now - lastPtrMove < 16) return;
        lastPtrMove = now;
        const rect = canvas.getBoundingClientRect();
        hoverX = e.clientX - rect.left;
        hoverY = e.clientY - rect.top;
        targetHoverStrength = 1;
        playMotifTone(motifName);
      },
      { passive: true }
    );
    canvas.addEventListener("pointerleave", () => {
      targetHoverStrength = 0;
      hoverX = -9999;
      hoverY = -9999;
    });
  }

  function renderFrame(t) {
    if (w <= 0 || h <= 0) return;
    ctx.clearRect(0, 0, w, h);

    // Keep padding inside box so ripples/parallax never escape the canvas bounds
    const pad = 12;
    const halfW = Math.max(10, w / 2 - pad);
    const halfH = Math.max(10, h / 2 - pad);
    const scale = Math.min(halfW, halfH);
    const fontSize = clamp(Math.round(scale * 0.13), 10, 16);

    ctx.font = `${fontSize}px ${fontMono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const pxOff = staticMode ? 0 : clamp(globalPtr.cx * parallaxAmt, -8, 8);
    const pyOff = staticMode ? 0 : clamp(globalPtr.cy * parallaxAmt, -8, 8);
    const cx = w / 2 + pxOff;
    const cy = h / 2 + pyOff;

    const glyphs = sampleMotif(motifName, t);
    const rippleR = Math.max(48, scale * 0.65);

    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i];
      let gx = cx + g.x * scale;
      let gy = cy + g.y * scale;
      let alpha = g.alpha * opacityScale;

      if (!staticMode && hoverStrength > 0.01) {
        const dx = gx - hoverX;
        const dy = gy - hoverY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < rippleR && dist > 0.001) {
          const k = (1 - dist / rippleR) * hoverStrength;
          const push = k * 7;
          gx += (dx / dist) * push;
          gy += (dy / dist) * push;
          alpha = clamp(alpha + k * 0.35, 0, 1);
        }
      }

      // Clamp strictly inside canvas box
      gx = clamp(gx, 6, w - 6);
      gy = clamp(gy, 6, h - 6);

      ctx.fillStyle = toRgba(getColor(g.colorVar), clamp(alpha, 0, 1));
      ctx.fillText(g.ch, gx, gy);
    }
  }

  let rafId = null;
  let running = false;
  let isVisible = true;
  let lastTime = 0;
  let animTime = Math.random() * 10; // varied initial phase
  let slowFrames = 0;
  let fpsCap = 60;

  function loop(now) {
    if (!running) return;
    const dt = now - lastTime;
    const minInterval = 1000 / fpsCap;
    if (dt < minInterval - 1) {
      rafId = requestAnimationFrame(loop);
      return;
    }

    // Adaptive FPS drop to 30fps if frames are heavy
    if (dt > 28) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 8) fpsCap = 30;

    lastTime = now;
    const sec = Math.min(dt, 80) / 1000;
    animTime += sec;

    // Lerp pointer & hover
    globalPtr.cx = lerp(globalPtr.cx, globalPtr.tx, 0.06);
    globalPtr.cy = lerp(globalPtr.cy, globalPtr.ty, 0.06);
    hoverStrength = lerp(hoverStrength, targetHoverStrength, 0.12);

    renderFrame(animTime);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (staticMode) {
      renderFrame(1.2);
      return;
    }
    if (running || !isVisible || document.hidden) return;
    running = true;
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  const io = new IntersectionObserver(
    ([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) start();
      else stop();
    },
    { threshold: 0.01 }
  );
  io.observe(canvas);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  let resizeTimer = null;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      renderFrame(staticMode ? 1.2 : animTime);
    }, 120);
  });
  ro.observe(canvas);

  resize();
  renderFrame(staticMode ? 1.2 : animTime);
  start();
}
