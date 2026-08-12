/*
 * Regenerates public/banner.png by screenshotting the published site.
 * The banner is a picture of the real page header, so it cannot fall out
 * of date with the design the way a hand-drawn copy would.
 *
 *   pnpm add -D playwright
 *   node scripts/capture-banner.mjs public/banner.png 900
 *   pnpm remove playwright
 *
 * Playwright is installed only for the capture because it downloads a
 * browser, which is a lot to carry for an image that changes rarely.
 *
 * Everything this script changes on the page applies to the screenshot
 * alone. The published site is not modified.
 */
import { chromium } from "playwright";

const out = process.argv[2];

// A narrower window makes the title and the artwork sit closer together,
// because the page lays them out in two columns and the artwork column is
// a fixed width. At the full desktop width the leftover space between them
// ends up as a wide empty stretch of colour.
const width = Number(process.argv[3] ?? 1280);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width, height: 900 },
  // Capture at double resolution so the image stays sharp on high-density
  // displays.
  deviceScaleFactor: 2,
});
await page.goto("https://cotlsave.com/", { waitUntil: "networkidle" });

await page.addStyleTag({
  content: `
    /* Remove the page's own backgrounds. Anything left uncovered is then
       saved as transparent, which is what lets the finished image sit on
       a light or a dark page without a visible box around it. */
    html, body, #app { background: transparent !important; }
    #app::after { display: none !important; }

    /* Keep only the title area: hide the navigation bar, the footer, and
       the body of the page below the title. */
    .topbar, footer { display: none !important; }
    .shell > *:not(.hero) { display: none !important; }
    .shell { width: 100% !important; padding: 0 !important; }
    .hero { min-height: 0 !important; padding: 30px 64px 34px !important; }

    /* Give the red panel behind the title a ragged, torn-paper edge along
       its top and bottom.

       The effect comes from hiding parts of the panel. The hidden shape
       is described by three horizontal bands that sit end to end and
       never overlap: a row of triangles at the top, a plain rectangle
       filling the middle, and a matching row of triangles at the bottom.
       Each triangle row is one small tile repeated across the width.

       The bottom row is the top row flipped upside down. Flipping it
       left to right instead looks similar in isolation but leaves a gap
       between neighbouring triangles, which reads as a row of detached
       blocks rather than a single torn edge. */
    #app::before {
      top: 0 !important;
      height: var(--field-split) !important;
      -webkit-mask:
        linear-gradient(135deg, transparent 50%, #000 51%) 0 0 / 18px 10px repeat-x,
        linear-gradient(#000, #000) 0 10px / 100% calc(100% - 20px) no-repeat,
        linear-gradient(315deg, transparent 50%, #000 51%) 0 100% / 18px 10px repeat-x;
      mask:
        linear-gradient(135deg, transparent 50%, #000 51%) 0 0 / 18px 10px repeat-x,
        linear-gradient(#000, #000) 0 10px / 100% calc(100% - 20px) no-repeat,
        linear-gradient(315deg, transparent 50%, #000 51%) 0 100% / 18px 10px repeat-x;
    }
  `,
});

// Show the address instead of the tagline, so the image says where to
// find the site when it appears somewhere else.
await page.evaluate(() => {
  const hook = document.querySelector(".hook");
  if (hook) hook.textContent = "cotlsave.com";
});

// Wait for the web fonts, or the title is measured and photographed in a
// fallback typeface.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

// The red panel is normally a fixed height set by the page. Shorten it to
// end just past whichever is lower, the title text or the disk artwork,
// so the finished image has no empty band of colour along the bottom.
const box = await page.evaluate(() => {
  const bottoms = [".hero-copy", ".save-emblem"].map(
    (sel) => document.querySelector(sel).getBoundingClientRect().bottom,
  );
  const height = Math.ceil(Math.max(...bottoms) + 34);
  document.documentElement.style.setProperty("--field-split", `${height}px`);
  return { height };
});
await page.waitForTimeout(150);

// omitBackground keeps the areas cut away by the torn edge transparent
// rather than filling them with white.
await page.screenshot({
  path: out,
  omitBackground: true,
  clip: { x: 0, y: 0, width, height: box.height },
});
console.log(JSON.stringify({ width, ...box, ratio: +(width / box.height).toFixed(2) }));
await browser.close();
