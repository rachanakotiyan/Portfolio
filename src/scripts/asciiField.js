// asciiField.js — ASCII motion hero engine
// HOW TO TUNE: edit the constants below.
//   FIELD_SPEED   — drift speed (lower = slower). Default 0.4
//   FIELD_DENSITY — fraction of cells populated (0–1). Default 0.72
//   CURSOR_RADIUS — px ripple radius. Default 110
//   BALL_RADIUS   — mirrorball radius in chars. Default 7
//   MOTIF_MIN_MS / MOTIF_MAX_MS — timing range for hidden motifs

// ─── Character ramp (darkest → brightest) ───────────────────────────────────
const RAMP = " .·:+*#";

// ─── Tweakable constants ─────────────────────────────────────────────────────
const FIELD_SPEED   = 0.4;   // drift wave speed
const FIELD_DENSITY = 0.72;  // fraction of grid cells populated
const CURSOR_RADIUS = 110;   // px ripple radius
const BALL_RADIUS   = 7;     // mirrorball radius in character units
const MOTIF_MIN_MS  = 20000; // min ms between motif appearances
const MOTIF_MAX_MS  = 40000; // max ms between motif appearances
const FPS_CAP       = 60;    // normal fps target
const FPS_HEAVY_CAP = 30;    // fps cap when falling behind
const FRAME_BUDGET  = 1000 / FPS_HEAVY_CAP;

// ─── Hidden motifs ───────────────────────────────────────────────────────────
// Each motif is { rows: string[], colorVar?: string }
// colorVar defaults to "--lilac". Use "--spark" ONLY for passion motif.
export const MOTIFS = {
  fish: {
    rows: [
      "><(((º>    <º)))><",
      "  ><(º>  <º)><   ",
    ],
    colorVar: "--lilac",
  },
  note: {
    rows: [
      "♩ ♪",
      " ♫  ",
      "♬   ",
    ],
    colorVar: "--lilac",
  },
  spark: {
    rows: [
      " ♥ ",
      "✦ ✦",
      " ♥ ",
    ],
    colorVar: "--spark",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp  = (a, b, t)   => a + (b - a) * t;

/** Read a CSS variable from :root */
function cssVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/** Cheap 2-D value noise: returns 0–1 */
function noise2(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.3) * 43758.545;
  return n - Math.floor(n);
}

/** Smooth sine-based field value at (cx, cy, time) → 0–1 */
function fieldVal(cx, cy, t) {
  return (
    Math.sin(cx * 0.18 + t * FIELD_SPEED) * 0.4 +
    Math.sin(cy * 0.22 - t * FIELD_SPEED * 0.7) * 0.3 +
    Math.sin((cx + cy) * 0.12 + t * FIELD_SPEED * 0.5) * 0.3
  ) * 0.5 + 0.5;
}

/** Mirrorball sphere: returns { ch, brightness, isFacet } or null */
function mirrorball(cx, cy, bx, by, br, t) {
  const dx = cx - bx;
  const dy = (cy - by) * 1.6; // squish Y so it looks spherical in mono font
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > br) return null;

  // Surface normal (approximate sphere)
  const nz = Math.sqrt(Math.max(0, 1 - (dist / br) ** 2));
  const nx = dx / br;
  const ny = dy / (br * 1.6) * 1.6;

  // Facet grid: rotate angle over time
  const angle = Math.atan2(ny, nx) + t * 0.25;
  const theta = Math.acos(clamp(nz, -1, 1));
  const facetU = Math.floor(angle / (Math.PI / 7)) * (Math.PI / 7);
  const facetV = Math.floor(theta / (Math.PI / 6)) * (Math.PI / 6);

  const facetHash = noise2(facetU * 31, facetV * 17, 1);

  // Specular glint: a few bright spots
  const spec = Math.max(0,
    Math.sin(facetU * 3 + t * 0.6) *
    Math.cos(facetV * 5 - t * 0.4)
  );

  const brightness = clamp(nz * 0.6 + facetHash * 0.3 + spec * 1.2, 0, 1);

  // Pick character from ramp
  const rampIdx = Math.floor(brightness * (RAMP.length - 1));
  const ch = RAMP[rampIdx] === " " ? "·" : RAMP[rampIdx];

  return { ch, brightness, isGlint: spec > 0.85 };
}

// ─── Main init ───────────────────────────────────────────────────────────────
export function initAsciiField(canvas, opts = {}) {
  const {
    mirrorball: showBall = true,
    dimmed = false,          // Lab mode: lower opacity, no ball
    opacityScale = 1,
  } = opts;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = window.innerWidth < 640;
  const staticMode = prefersReduced || isMobile;

  // ── Colours (read from CSS vars once; re-read on resize for safety) ─────
  let COL_LILAC, COL_SPARK;
  function readColors() {
    COL_LILAC = cssVar("--lilac");
    COL_SPARK = cssVar("--spark");
  }
  readColors();

  // ── Cell geometry ─────────────────────────────────────────────────────────
  const CELL_W = 11; // px per char (JetBrains Mono ~11px @ 14px)
  const CELL_H = 18;
  let cols, rows, dpr, cW, cH;

  function resize() {
    readColors();
    dpr = window.devicePixelRatio || 1;
    cW  = canvas.clientWidth;
    cH  = canvas.clientHeight;
    canvas.width  = cW * dpr;
    canvas.height = cH * dpr;
    ctx.scale(dpr, dpr);
    cols = Math.ceil(cW / CELL_W);
    rows = Math.ceil(cH / CELL_H);
    // Reset populated mask
    populateMask();
  }

  // ── Sparse field mask (FIELD_DENSITY) ────────────────────────────────────
  let mask; // Float32Array of 0/1
  function populateMask() {
    mask = new Float32Array(cols * rows);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = Math.random() < FIELD_DENSITY ? 1 : 0;
    }
  }

  // ── Cursor state ─────────────────────────────────────────────────────────
  let mouseX = -9999, mouseY = -9999;
  let lastPointer = 0;
  function onPointer(e) {
    const now = performance.now();
    if (now - lastPointer < 16) return; // throttle ~60fps
    lastPointer = now;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    mouseX = clientX - rect.left;
    mouseY = clientY - rect.top;
  }
  function onLeave() { mouseX = -9999; mouseY = -9999; }

  if (!staticMode) {
    canvas.addEventListener("pointermove", onPointer, { passive: true });
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("touchmove",   onPointer, { passive: true });
  }

  // ── Motif state ───────────────────────────────────────────────────────────
  let motifActive = false;
  let motifData   = null; // { rows, colorVar, cx, cy, life, maxLife }
  let motifTimer  = null;

  function scheduleMotif() {
    if (staticMode) return;
    const delay = MOTIF_MIN_MS + Math.random() * (MOTIF_MAX_MS - MOTIF_MIN_MS);
    motifTimer = setTimeout(showMotif, delay);
  }

  function showMotif() {
    const keys  = Object.keys(MOTIFS);
    const key   = keys[Math.floor(Math.random() * keys.length)];
    const motif = MOTIFS[key];
    const mRows = motif.rows.length;
    const mCols = Math.max(...motif.rows.map(r => r.length));

    // Place it somewhere in the middle two-thirds of the canvas
    const cx = Math.floor(cols * 0.17 + Math.random() * cols * 0.66);
    const cy = Math.floor(rows * 0.17 + Math.random() * rows * 0.66);

    motifData = {
      rows:     motif.rows,
      colorVar: motif.colorVar || "--lilac",
      cx, cy,
      mCols, mRows,
      life:    0,
      maxLife: 220, // frames (~3.6s at 60fps)
    };
    motifActive = true;
    scheduleMotif();
  }

  scheduleMotif();

  // ── Animation loop ────────────────────────────────────────────────────────
  let rafId   = null;
  let running = false;
  let lastFrame = 0;
  let t = 0; // animation time in seconds

  // Mirrorball position: horizontal centre, vertical 40% down
  const ballRelX = 0.5;
  const ballRelY = 0.42;

  function draw(now) {
    const delta = now - lastFrame;
    if (delta < FRAME_BUDGET - 2) {
      rafId = requestAnimationFrame(draw);
      return;
    }
    lastFrame = now;
    t += Math.min(delta, 100) / 1000; // cap at 0.1s to avoid jumps

    ctx.clearRect(0, 0, cW, cH);

    // Font for all characters
    ctx.font = `14px ${cssVar("--mono")}`;
    ctx.textBaseline = "top";

    const ballCX = cols * ballRelX;
    const ballCY = rows * ballRelY;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = col * CELL_W;
        const py = row * CELL_H;

        // ── Mirrorball ──────────────────────────────────────────────────
        if (showBall && !dimmed) {
          const ball = mirrorball(col, row, ballCX, ballCY, BALL_RADIUS, t);
          if (ball) {
            const alpha = clamp(ball.brightness * opacityScale, 0.08, 1);
            if (ball.isGlint) {
              ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            } else {
              ctx.fillStyle = hexToRgba(COL_LILAC, alpha);
            }
            ctx.fillText(ball.ch, px, py);
            continue;
          }
        }

        // ── Skip sparse cells ───────────────────────────────────────────
        if (!mask[row * cols + col]) continue;

        // ── Field value ─────────────────────────────────────────────────
        const fv = fieldVal(col, row, t);
        const rampIdx = Math.floor(fv * (RAMP.length - 1));
        let ch = RAMP[rampIdx];
        if (ch === " ") continue;

        // ── Cursor ripple ───────────────────────────────────────────────
        const pxCentre = px + CELL_W / 2;
        const pyCentre = py + CELL_H / 2;
        const dxM = pxCentre - mouseX;
        const dyM = pyCentre - mouseY;
        const distM = Math.sqrt(dxM * dxM + dyM * dyM);
        let alpha = clamp(fv * 0.65 * opacityScale, 0.05, 0.9);

        if (distM < CURSOR_RADIUS) {
          const influence = 1 - distM / CURSOR_RADIUS;
          alpha = clamp(alpha + influence * 0.55, 0, 1);
          // brighten character ramp
          const boosted = Math.min(rampIdx + Math.round(influence * 3), RAMP.length - 1);
          ch = RAMP[boosted];
        }

        ctx.fillStyle = hexToRgba(COL_LILAC, alpha);
        ctx.fillText(ch, px, py);
      }
    }

    // ── Motif overlay ───────────────────────────────────────────────────────
    if (motifActive && motifData) {
      const md = motifData;
      md.life++;
      // Fade in first 30 frames, hold, fade out last 30 frames
      let alpha;
      if (md.life < 30)               alpha = md.life / 30;
      else if (md.life > md.maxLife - 30) alpha = (md.maxLife - md.life) / 30;
      else                            alpha = 1;
      alpha = clamp(alpha * 0.9 * opacityScale, 0, 1);

      const color = cssVar(md.colorVar);
      ctx.fillStyle = hexToRgba(color, alpha);
      ctx.font = `14px ${cssVar("--mono")}`;

      for (let r = 0; r < md.mRows; r++) {
        const line = md.rows[r];
        for (let c = 0; c < line.length; c++) {
          const ch = line[c];
          if (ch === " ") continue;
          const px = (md.cx + c) * CELL_W;
          const py = (md.cy + r) * CELL_H;
          if (px >= 0 && py >= 0 && px < cW && py < cH) {
            ctx.fillText(ch, px, py);
          }
        }
      }

      if (md.life >= md.maxLife) motifActive = false;
    }

    if (running) rafId = requestAnimationFrame(draw);
  }

  // Static frame (mobile / reduced-motion) ─────────────────────────────────
  function drawStatic() {
    ctx.clearRect(0, 0, cW, cH);
    ctx.font = `14px ${cssVar("--mono")}`;
    ctx.textBaseline = "top";

    // Draw just the mirrorball at t=1
    if (showBall && !dimmed) {
      const ballCX = cols * ballRelX;
      const ballCY = rows * ballRelY;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ball = mirrorball(col, row, ballCX, ballCY, BALL_RADIUS, 1);
          if (ball) {
            const alpha = clamp(ball.brightness * 0.9 * opacityScale, 0.08, 1);
            ctx.fillStyle = hexToRgba(COL_LILAC, alpha);
            ctx.fillText(ball.ch, col * CELL_W, row * CELL_H);
          }
        }
      }
    }

    // A handful of scattered field chars
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!mask[row * cols + col]) continue;
        const fv = fieldVal(col, row, 1);
        const rampIdx = Math.floor(fv * (RAMP.length - 1));
        const ch = RAMP[rampIdx];
        if (ch === " ") continue;
        // Skip mirrorball region
        const ballCX = cols * ballRelX;
        const ballCY = rows * ballRelY;
        if (showBall && !dimmed) {
          const dx = col - ballCX;
          const dy = (row - ballCY) * 1.6;
          if (Math.sqrt(dx * dx + dy * dy) <= BALL_RADIUS) continue;
        }
        const alpha = clamp(fv * 0.5 * opacityScale, 0.04, 0.6);
        ctx.fillStyle = hexToRgba(COL_LILAC, alpha);
        ctx.fillText(ch, col * CELL_W, row * CELL_H);
      }
    }
  }

  // ── Visibility / intersection ─────────────────────────────────────────────
  function start() {
    if (staticMode) { drawStatic(); return; }
    if (running) return;
    running = true;
    lastFrame = performance.now();
    rafId = requestAnimationFrame(draw);
  }
  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else start();
  });

  const io = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) start(); else stop(); },
    { threshold: 0.01 }
  );
  io.observe(canvas);

  // ── Debounced resize ──────────────────────────────────────────────────────
  let resizeTimer;
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const wasRunning = running;
      stop();
      resize();
      if (staticMode) drawStatic();
      else if (wasRunning) start();
    }, 120);
  });
  resizeObserver.observe(canvas);

  // ── Boot ──────────────────────────────────────────────────────────────────
  resize();
  start();

  // Return teardown
  return () => {
    stop();
    clearTimeout(motifTimer);
    io.disconnect();
    resizeObserver.disconnect();
    canvas.removeEventListener("pointermove", onPointer);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("touchmove", onPointer);
  };
}

// ─── Utility: hex/rgb CSS colour → rgba(…) string ────────────────────────────
function hexToRgba(col, alpha) {
  col = col.trim();
  // Handle rgb(r g b) or rgb(r, g, b)
  if (col.startsWith("rgb")) {
    const nums = col.match(/[\d.]+/g);
    if (nums && nums.length >= 3) {
      return `rgba(${nums[0]},${nums[1]},${nums[2]},${alpha.toFixed(3)})`;
    }
  }
  // Handle #rrggbb or #rgb
  let hex = col.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  }
  return col;
}
