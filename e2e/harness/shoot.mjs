// Screenshots, named so a reviewer can tell which drive and which viewport
// produced them without opening the file: /tmp/drive-<name>-<viewport>.png

import { mkdirSync } from "node:fs";
import path from "node:path";

export const SHOT_DIR = process.env.E2E_SHOT_DIR ?? "/tmp";

/** Mobile 390x844 (iPhone 14-class) and desktop 1280x900 — the two shapes the
 * app is actually used in. */
export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 900 },
};

export function viewportName(page) {
  const size = page.viewportSize();

  if (!size) {
    return "unknown";
  }

  for (const [name, spec] of Object.entries(VIEWPORTS)) {
    if (spec.width === size.width) {
      return name;
    }
  }

  return `${size.width}x${size.height}`;
}

const taken = [];

/**
 * @param {import("playwright").Page} page
 * @param {string} name
 * @param {object} [opts]
 * @param {boolean} [opts.fullPage=true]
 * @param {import("playwright").Locator} [opts.of]  shoot just this element —
 *   the way to hand a reviewer a close-up of one component instead of a
 *   390px-wide page in which the thing under test is nine pixels across.
 */
export async function shoot(page, name, opts = {}) {
  mkdirSync(SHOT_DIR, { recursive: true });
  const file = path.join(SHOT_DIR, `drive-${name}-${viewportName(page)}.png`);

  if (opts.of) {
    await opts.of.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: opts.fullPage ?? true });
  }

  taken.push(file);

  return file;
}

export function screenshots() {
  return [...taken];
}
