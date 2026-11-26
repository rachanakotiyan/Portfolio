/**
 * Motif builders: each returns an array of glyph descriptors for frame t:
 *   { x, y, ch, colorVar, alpha, glint? }
 * Coordinates (x, y) are normalized roughly in [-0.88, 0.88] so everything
 * stays well inside the canvas bounding box even with hover/parallax ripples.
 */
import { MOTIF_SPEEDS, WINGS_ART, SPARKLES_ART, NOTES_ITEMS } from "./art.js";

const RAMP = "·:+*▒▓";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function hash2(a, b) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// 1. Mirrorball: hanging cord + rotating faceted sphere + ice-blue glints
function buildMirrorball(t, glyphs) {
  const sp = MOTIF_SPEEDS.mirrorball;
  // Thin hanging cord from top of box
  for (let i = 0; i < 6; i++) {
    const y = -0.88 + i * 0.055;
    glyphs.push({
      x: 0,
      y,
      ch: i % 2 === 0 ? "│" : "·",
      colorVar: "--mirrorball-main",
      alpha: 0.55,
    });
  }

  const cy = 0.08;
  const r = 0.56;
  const rows = 15;
  for (let iy = -rows; iy <= rows; iy++) {
    const ny = iy / rows;
    if (Math.abs(ny) > 0.98) continue;
    const rowR = Math.sqrt(1 - ny * ny);
    const cols = Math.max(2, Math.round(rowR * 17));
    for (let ix = -cols; ix <= cols; ix++) {
      const nx = (ix / (cols || 1)) * rowR;
      const dist = Math.sqrt(nx * nx + ny * ny);
      if (dist > 0.99) continue;
      const nz = Math.sqrt(Math.max(0, 1 - dist * dist));

      // Rotating longitude for facets
      const lon = Math.atan2(nx, nz) + t * sp;
      const lat = Math.asin(clamp(ny, -1, 1));
      const fLon = Math.floor(lon / 0.34);
      const fLat = Math.floor(lat / 0.28);
      const facetNoise = hash2(fLon, fLat);

      // Sweeping glint highlight
      const glintWave = Math.sin(lon * 2.2 - lat * 1.5 - t * sp * 1.8);
      const isGlint = glintWave > 0.86 && facetNoise > 0.42;

      const light = clamp(nz * 0.55 + facetNoise * 0.32 + Math.max(0, glintWave) * 0.35, 0.2, 1);
      let ch = "▪";
      if (isGlint) ch = glintWave > 0.94 ? "✦" : "+";
      else if (light > 0.78) ch = "▓";
      else if (light > 0.62) ch = "▒";
      else if (light > 0.46) ch = "▫";
      else if (light > 0.32) ch = "▪";
      else ch = "·";

      glyphs.push({
        x: nx * r,
        y: cy + ny * r,
        ch,
        colorVar: isGlint ? "--mirrorball-glint" : "--mirrorball-main",
        alpha: isGlint ? 1 : clamp(0.48 + light * 0.48, 0.48, 0.96),
      });
    }
  }
}

// 2. Yin-yang Koi pair + drifting bamboo strokes
function buildKoi(t, glyphs) {
  const rot = t * MOTIF_SPEEDS.koi;
  const orbitR = 0.44;

  // Two fish swimming head-to-tail
  const fishes = [
    { baseAngle: 0, bodyColor: "--koi-pearl", outlineColor: "--koi-pearl", isLilac: false },
    { baseAngle: Math.PI, bodyColor: "--koi-lilac", outlineColor: "--koi-outline", isLilac: true },
  ];

  for (const fish of fishes) {
    const segs = 20;
    for (let i = 0; i < segs; i++) {
      const u = i / (segs - 1); // 0 = head, 1 = tail
      const swimWiggle = Math.sin(t * 2.4 - u * 4.2) * 0.04 * u;
      const theta = fish.baseAngle + rot - u * 2.15;
      const r = orbitR + swimWiggle;
      const cx = Math.cos(theta) * r;
      const cy = Math.sin(theta) * r;

      // Body thickness tapers from head to tail
      const halfW = u < 0.2 ? 0.06 + u * 0.35 : Math.max(0.015, 0.13 * (1 - (u - 0.2) * 1.05));
      const rx = Math.cos(theta);
      const ry = Math.sin(theta);

      // Outline/fill points across width
      const steps = u > 0.82 ? 3 : 2;
      for (let s = -steps; s <= steps; s++) {
        const wOff = (s / steps) * halfW;
        // Forked tail at the end
        const tailSplit = u > 0.82 ? (s === 0 ? 0.03 : 0) : 0;
        const px = cx + rx * wOff - Math.sin(theta) * tailSplit;
        const py = cy + ry * wOff + Math.cos(theta) * tailSplit;

        const isEdge = Math.abs(s) === steps;
        const isSpot = u >= 0.12 && u <= 0.32 && Math.abs(s) <= 1;

        let colorVar = fish.bodyColor;
        let ch = isEdge ? "·" : "⣿";
        if (isSpot) {
          colorVar = "--koi-vermilion";
          ch = "●";
        } else if (fish.isLilac && isEdge) {
          colorVar = fish.outlineColor;
          ch = ":";
        } else if (u > 0.82) {
          ch = s === 0 ? "·" : "⠇";
        }

        glyphs.push({
          x: px,
          y: py,
          ch,
          colorVar,
          alpha: isSpot ? 0.95 : isEdge ? 0.85 : 0.9,
        });
      }

      // Pectoral fins near u ~ 0.28
      if (i === 5 || i === 6) {
        const finDir = i === 5 ? 1 : -1;
        for (let f = 1; f <= 3; f++) {
          const fw = (halfW + f * 0.045) * finDir;
          glyphs.push({
            x: cx + rx * fw - Math.sin(theta) * f * 0.02,
            y: cy + ry * fw + Math.cos(theta) * f * 0.02,
            ch: f === 3 ? "·" : "⠃",
            colorVar: fish.isLilac ? fish.outlineColor : fish.bodyColor,
            alpha: 0.72,
          });
        }
      }
    }
  }

  // Drifting bamboo-leaf strokes in muted teal
  const bambooAnchors = [
    { x: -0.66, y: -0.58, ang: 0.45 },
    { x: -0.54, y: -0.68, ang: 0.85 },
    { x:  0.64, y:  0.58, ang: -2.6 },
    { x:  0.50, y:  0.68, ang: -2.2 },
  ];
  for (let b = 0; b < bambooAnchors.length; b++) {
    const ba = bambooAnchors[b];
    const sway = Math.sin(t * 0.7 + b) * 0.025;
    for (let k = 0; k < 4; k++) {
      glyphs.push({
        x: ba.x + Math.cos(ba.ang) * k * 0.045 + sway,
        y: ba.y + Math.sin(ba.ang) * k * 0.045,
        ch: k === 0 ? "/" : k === 3 ? "·" : "╱",
        colorVar: "--koi-bamboo",
        alpha: 0.78 - k * 0.1,
      });
    }
  }
}

// 3a. Spiral Sun (tribal curling rays + hypnotic spiral center)
function buildSun(t, glyphs) {
  const rot = t * MOTIF_SPEEDS.sun;
  // Spiral center
  const spiralPts = 54;
  for (let i = 0; i < spiralPts; i++) {
    const u = i / (spiralPts - 1);
    const theta = u * Math.PI * 4.4 + rot;
    const r = 0.03 + u * 0.30;
    glyphs.push({
      x: Math.cos(theta) * r,
      y: Math.sin(theta) * r,
      ch: u > 0.7 ? "⣿" : u > 0.3 ? "⡇" : "*",
      colorVar: "--sun-gold",
      alpha: 0.75 + 0.2 * Math.sin(t * 1.1 + u * 4),
    });
  }

  // 9 bold curling rays
  const rays = 9;
  for (let rIdx = 0; rIdx < rays; rIdx++) {
    const baseAng = (rIdx / rays) * Math.PI * 2 + rot;
    for (let s = 0; s < 9; s++) {
      const u = s / 8;
      const rad = 0.34 + u * 0.48;
      const curl = Math.sin(u * Math.PI * 1.1) * 0.22;
      const ang = baseAng + curl;
      glyphs.push({
        x: Math.cos(ang) * rad,
        y: Math.sin(ang) * rad,
        ch: u < 0.35 ? "⣿" : u < 0.7 ? "⠇" : "·",
        colorVar: "--sun-gold",
        alpha: 0.9 - u * 0.32,
      });
    }
  }
}

// 3b. Spiral Star (5-pointed distressed star with inner spiral)
function buildStar(t, glyphs) {
  const rot = t * MOTIF_SPEEDS.star;
  const pulse = 0.84 + 0.16 * Math.sin(t * 1.35 + 1.1);
  const points = 5;
  const rOut = 0.80;
  const rIn = 0.34;

  // Star outline & distressed fill
  for (let p = 0; p < points * 2; p++) {
    const a1 = (p / (points * 2)) * Math.PI * 2 - Math.PI / 2 + rot;
    const a2 = ((p + 1) / (points * 2)) * Math.PI * 2 - Math.PI / 2 + rot;
    const rad1 = p % 2 === 0 ? rOut : rIn;
    const rad2 = p % 2 === 0 ? rIn : rOut;
    const x1 = Math.cos(a1) * rad1, y1 = Math.sin(a1) * rad1;
    const x2 = Math.cos(a2) * rad2, y2 = Math.sin(a2) * rad2;

    for (let s = 0; s < 6; s++) {
      const u = s / 6;
      const n = hash2(p, s);
      if (n < 0.14) continue; // distressed texture
      glyphs.push({
        x: x1 + (x2 - x1) * u,
        y: y1 + (y2 - y1) * u,
        ch: n > 0.6 ? "⠇" : ":",
        colorVar: "--star-indigo",
        alpha: 0.72 * pulse,
      });
    }
  }

  // Inner spiral in pale lilac
  const spPts = 46;
  for (let i = 0; i < spPts; i++) {
    const u = i / (spPts - 1);
    const theta = u * Math.PI * 4.8 - rot * 1.2;
    const r = 0.02 + u * 0.42;
    if (hash2(i, 7) < 0.1) continue;
    glyphs.push({
      x: Math.cos(theta) * r,
      y: Math.sin(theta) * r,
      ch: u > 0.6 ? "⡇" : "+",
      colorVar: "--star-lilac",
      alpha: (0.85 - u * 0.15) * pulse,
    });
  }
}

// 4. Musical notes and stars on wavy staff lines
function buildNotes(t, glyphs) {
  const sp = MOTIF_SPEEDS.notes;
  // 4 wavy staff lines
  for (let l = 0; l < 4; l++) {
    const baseY = -0.30 + l * 0.20;
    for (let i = 0; i < 28; i++) {
      const u = i / 27;
      const x = -0.84 + u * 1.68;
      const wave = Math.sin(u * Math.PI * 2.4 + t * 0.5) * 0.09;
      glyphs.push({
        x,
        y: baseY + wave,
        ch: i % 3 === 0 ? "·" : "─",
        colorVar: "--notes-staff",
        alpha: 0.65,
      });
    }
  }

  // Drifting notes and blinking stars
  for (const item of NOTES_ITEMS) {
    if (item.kind === "note") {
      const u = (item.u + t * sp * 0.12) % 1;
      const x = -0.82 + u * 1.64;
      const wave = Math.sin(u * Math.PI * 2.4 + t * 0.5) * 0.09;
      const y = -0.30 + item.line * 0.20 + wave;
      glyphs.push({
        x,
        y,
        ch: item.ch,
        colorVar: "--notes-teal",
        alpha: 0.94,
      });
    } else {
      const x = -0.82 + item.u * 1.64;
      const wave = Math.sin(item.u * Math.PI * 2.4 + t * 0.5) * 0.09;
      const y = -0.30 + item.line * 0.20 + wave;
      const blink = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.1 + item.phase));
      glyphs.push({
        x,
        y,
        ch: item.ch,
        colorVar: "--notes-star",
        alpha: blink,
      });
    }
  }
}

// 5. Galaxy swirl (dotted spiral + twinkling 4-point stars)
function buildGalaxy(t, glyphs) {
  const rot = t * MOTIF_SPEEDS.galaxy;
  const arms = 2;
  const ptsPerArm = 62;

  for (let a = 0; a < arms; a++) {
    const armOffset = (a / arms) * Math.PI * 2;
    for (let i = 0; i < ptsPerArm; i++) {
      const u = i / (ptsPerArm - 1);
      const spread = (hash2(a, i) - 0.5) * 0.16 * u;
      const theta = armOffset + u * Math.PI * 3.1 + rot + spread;
      const r = 0.04 + u * 0.74;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r * 0.78; // gentle tilt

      const isCore = u < 0.28;
      const idx = Math.floor((1 - u) * (RAMP.length - 1));
      glyphs.push({
        x,
        y,
        ch: isCore ? (u < 0.12 ? "⣿" : "*") : RAMP[idx],
        colorVar: isCore ? "--galaxy-core" : "--galaxy-outer",
        alpha: clamp((1 - u * 0.52) * 0.92, 0.42, 0.96),
      });
    }
  }

  // Twinkling 4-point sparkle stars
  const stars = [
    { x: -0.68, y: -0.52, p: 0.4 },
    { x:  0.64, y: -0.44, p: 2.1 },
    { x: -0.56, y:  0.56, p: 3.8 },
    { x:  0.70, y:  0.48, p: 5.0 },
  ];
  for (const st of stars) {
    const twinkle = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(t * 1.9 + st.p));
    glyphs.push({
      x: st.x,
      y: st.y,
      ch: "✦",
      colorVar: "--galaxy-core",
      alpha: twinkle,
    });
  }
}

// 6. Braille wings with tiny blinking sparkles
function buildWings(t, glyphs) {
  const rows = WINGS_ART.length;
  const cols = WINGS_ART[0].length;
  for (let r = 0; r < rows; r++) {
    const line = WINGS_ART[r];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === " ") continue;
      const x = ((c / (cols - 1)) * 2 - 1) * 0.84;
      const y = ((r / (rows - 1)) * 2 - 1) * 0.72;
      const isSparkle = ch === "✦" || ch === "+" || ch === "·";
      const alpha = isSparkle
        ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * MOTIF_SPEEDS.wings * 3.1 + c * 0.7 + r))
        : 0.88;
      glyphs.push({
        x,
        y,
        ch,
        colorVar: "--wings-silver",
        alpha,
      });
    }
  }
}

// 7. Tiny + and ✦ sparkles
function buildSparkles(t, glyphs) {
  for (const s of SPARKLES_ART) {
    const blink = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * MOTIF_SPEEDS.sparkles * 2.5 + s.phase));
    glyphs.push({
      x: s.x,
      y: s.y,
      ch: s.ch,
      colorVar: "--sparkle-silver",
      alpha: blink,
    });
  }
}

const BUILDERS = {
  mirrorball: buildMirrorball,
  koi: buildKoi,
  sun: buildSun,
  star: buildStar,
  notes: buildNotes,
  galaxy: buildGalaxy,
  wings: buildWings,
  sparkles: buildSparkles,
};

export function sampleMotif(name, t) {
  const glyphs = [];
  const builder = BUILDERS[name];
  if (builder) builder(t, glyphs);
  return glyphs;
}
