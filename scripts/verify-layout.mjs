import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const DIST = path.resolve("dist");
const OUT_DIR = path.resolve("scripts/screenshots");
fs.mkdirSync(OUT_DIR, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".xml": "application/xml",
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || "/").split("?")[0];
      let filePath = path.join(DIST, urlPath === "/" ? "index.html" : urlPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
      if (!fs.existsSync(filePath)) {
        filePath = path.join(DIST, "404.html");
        res.statusCode = 404;
      }
      const ext = path.extname(filePath);
      res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function boxesIntersect(a, b) {
  return !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
}

async function run() {
  const { server, url } = await startServer();
  let browser;
  try {
    try {
      browser = await chromium.launch({ channel: "chrome" });
    } catch {
      browser = await chromium.launch({ channel: "msedge" });
    }

    const widths = [1440, 1280, 1024, 768, 390];
    let failures = 0;

    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();

      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(250);

      // Capture opening screenshot at 1280 & 390
      if (width === 1280 || width === 390) {
        await page.screenshot({ path: path.join(OUT_DIR, `opening-${width}.png`) });
      }

      // Dismiss opening if present
      const skip = page.locator("[data-opening-skip]");
      if (await skip.isVisible().catch(() => false)) {
        await skip.click();
        await page.waitForTimeout(750);
      }

      // Let animations render a couple frames
      await page.waitForTimeout(350);

      if (width === 1280 || width === 390) {
        await page.screenshot({ path: path.join(OUT_DIR, `home-${width}.png`), fullPage: false });
      }
      await page.screenshot({ path: path.join(OUT_DIR, `check-${width}.png`), fullPage: false });

      // Check bounding boxes of visible motif canvases & text elements
      const report = await page.evaluate(() => {
        const isVisible = (el) => {
          const st = getComputedStyle(el);
          if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };

        const motifs = Array.from(document.querySelectorAll(".poster-hero .motif-canvas"))
          .filter((el) => isVisible(el.closest(".motif-box") || el))
          .map((el) => {
            const r = el.getBoundingClientRect();
            const ctx = el.getContext("2d");
            let nonZero = 0;
            if (ctx && el.width > 0 && el.height > 0) {
              const data = ctx.getImageData(0, 0, el.width, el.height).data;
              for (let i = 3; i < data.length; i += 16) {
                if (data[i] > 10) { nonZero++; break; }
              }
            }
            return {
              kind: "motif",
              name: el.dataset.motif || "unknown",
              nonBlank: nonZero > 0,
              box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
            };
          });

        const texts = Array.from(document.querySelectorAll(".poster-hero .hero-text-zone"))
          .filter(isVisible)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              kind: "text",
              name: el.className,
              box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
            };
          });

        return { motifs, texts };
      });

      const all = [...report.motifs, ...report.texts];
      const overlaps = [];
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          if (boxesIntersect(all[i].box, all[j].box)) {
            overlaps.push(`${all[i].name} <-> ${all[j].name}`);
          }
        }
      }

      const blankMotifs = report.motifs.filter((m) => !m.nonBlank).map((m) => m.name);
      console.log(
        `[${width}px] motifs=${report.motifs.length} texts=${report.texts.length} overlaps=${overlaps.length} blank=${blankMotifs.length}`
      );
      if (overlaps.length > 0) {
        console.error(`  OVERLAP at ${width}px:`, overlaps);
        failures++;
      }
      if (blankMotifs.length > 0) {
        console.error(`  BLANK MOTIFS at ${width}px:`, blankMotifs);
        failures++;
      }

      await context.close();
    }

    // Lab page screenshots at 1280 & 390
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await page.goto(`${url}/lab`, { waitUntil: "networkidle" });
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(OUT_DIR, `lab-${width}.png`), fullPage: false });

      const labNonBlank = await page.evaluate(() => {
        const el = document.querySelector('.lab-page .motif-canvas[data-motif="galaxy"]');
        if (!el || el.width === 0 || el.height === 0) return false;
        const data = el.getContext("2d").getImageData(0, 0, el.width, el.height).data;
        for (let i = 3; i < data.length; i += 16) {
          if (data[i] > 10) return true;
        }
        return false;
      });
      console.log(`[lab ${width}px] galaxy nonBlank=${labNonBlank}`);
      if (!labNonBlank) failures++;
      await context.close();
    }

    if (failures > 0) {
      console.error(`FAILED with ${failures} error(s).`);
      process.exitCode = 1;
    } else {
      console.log("ALL CHECKS PASSED: 0 overlaps, all motifs visible.");
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

run();
