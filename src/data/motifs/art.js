/**
 * Editable motif configuration & ASCII/braille art data.
 * Tweak speeds, densities, and static patterns here.
 */

export const MOTIF_SPEEDS = {
  mirrorball: 0.35,
  koi: 0.28,
  sun: 0.16,
  star: 0.14,
  notes: 0.24,
  galaxy: 0.09,
  wings: 0.65,
  sparkles: 0.75,
};

// Braille wings pattern (inspired by dotted angel wings reference)
export const WINGS_ART = [
  "  ✦ ·                             · ✦  ",
  "    ⣿⠇·                         ·⠇⣿    ",
  "   ⢸⡇ ⠘⡄                      ⢠⠃ ⢸⡇   ",
  "   ⢸⡇  ⠘⢄     ·       ·     ⡠⠃  ⢸⡇   ",
  "  ⢀⡿    ⠈⠢⡀  ⢀⠃     ⠘⡀  ⢀⠔⠁    ⢿⡀  ",
  "  ⢸⡇  ⡀   ⠑⢄ ⢸  ⢀⣀⡀  ⡇ ⡠⠊   ⢀  ⢸⡇  ",
  "  ⢸⣇ ⠸⣄  ⢀⣀⣈⠿⣄⣸⣿⠁⠈⣿⣇⣠⠿⣁⣀⡀  ⣠⠇ ⣸⡇  ",
  "   ⢿⡄ ⠈⠛⠉⠁  ⠈⠻⣿⣿⠏  ⠹⣿⣿⠟⠁  ⠈⠉⠛⠁ ⢠⡿   ",
  "   ⠈⢿⣄   ⢀⣠⠞⠁ ⠈⠛⠁  ⠈⠛⠁ ⠈⠳⣄⡀   ⣠⡿⠁   ",
  "  +  ⠈⠛⠶⠛⠉                  ⠉⠛⠶⠛⠁  + ",
  "       · ✦                    ✦ ·      ",
];

// Sparse sparkle punctuation cluster
export const SPARKLES_ART = [
  { x: -0.65, y: -0.45, ch: "✦", phase: 0.0 },
  { x:  0.55, y: -0.55, ch: "+", phase: 1.7 },
  { x: -0.20, y:  0.10, ch: "·", phase: 2.9 },
  { x:  0.70, y:  0.25, ch: "✦", phase: 4.1 },
  { x: -0.50, y:  0.60, ch: "+", phase: 5.3 },
  { x:  0.15, y: -0.25, ch: "·", phase: 0.8 },
];

// Musical notes & stars data along wavy staff lines
export const NOTES_ITEMS = [
  { u: 0.10, line: 1.5, ch: "𝄞", phase: 0.2, kind: "note" },
  { u: 0.30, line: 2.0, ch: "♫", phase: 1.4, kind: "note" },
  { u: 0.50, line: 1.0, ch: "♪", phase: 2.6, kind: "note" },
  { u: 0.72, line: 2.5, ch: "♩", phase: 3.8, kind: "note" },
  { u: 0.90, line: 1.5, ch: "♫", phase: 5.0, kind: "note" },
  { u: 0.20, line: -0.4, ch: "✦", phase: 0.9, kind: "star" },
  { u: 0.42, line: 3.4,  ch: "✦", phase: 2.3, kind: "star" },
  { u: 0.62, line: -0.2, ch: "*", phase: 3.7, kind: "star" },
  { u: 0.83, line: 3.2,  ch: "✦", phase: 5.1, kind: "star" },
];
