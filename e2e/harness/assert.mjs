// Assertion helpers for browser drives.
//
// Every one of these THROWS with a message that names what was looked for,
// what was found, and where — a failing drive must be diagnosable from the
// console output alone, without re-running it in headed mode.
//
// Visibility, not styling: `expectVisible` resolves to an element that is
// actually painted (non-zero box, not `display:none`, not `visibility:hidden`).
// That is the whole point — the two bugs that slipped past the fixture tests
// (a `hidden` segment that never switched, a <span> "control" with no handler)
// were both invisible to a "does the string exist in the HTML" check.

const DEFAULT_TIMEOUT = 8000;

// Tag names a bare one-word target may legitimately mean. Anything else that
// is one bare word ("Recent", "Overview") is TEXT — guessing wrong here is a
// silent 0-match, which is the most confusing failure a drive can produce.
const HTML_TAGS = new Set([
  "a",
  "article",
  "aside",
  "body",
  "button",
  "canvas",
  "circle",
  "div",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "html",
  "iframe",
  "img",
  "input",
  "label",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "path",
  "picture",
  "rect",
  "section",
  "select",
  "source",
  "span",
  "svg",
  "table",
  "tbody",
  "td",
  "textarea",
  "th",
  "thead",
  "tr",
  "ul",
  "video",
]);

/**
 * Accepts a ready-made Playwright Locator, an engine-prefixed string
 * (`css=`, `text=`, `xpath=`, `//…`), a CSS/Playwright selector, or plain
 * visible TEXT.
 *
 * Disambiguation, in order:
 *   1. an explicit engine prefix wins
 *   2. `.foo` / `#foo` / `[attr]` / `*` is CSS
 *   3. `tag` followed by one of `. # : [ > ~ +` is CSS — this is what makes
 *      `h2:text-is("Recent")` and `svg[aria-label="…"]` work
 *   4. a bare word that is a known HTML tag is CSS
 *   5. everything else is TEXT
 *
 * When in doubt, prefix it: `css=…` or pass a Locator.
 */
export function resolve(page, target) {
  if (
    target &&
    typeof target === "object" &&
    typeof target.count === "function"
  ) {
    return target;
  }

  if (typeof target !== "string") {
    throw new TypeError(`Unsupported assertion target: ${String(target)}`);
  }

  if (/^(css=|xpath=|text=|role=|id=|data-testid=|\/\/)/.test(target)) {
    return page.locator(target);
  }

  if (/^[.#[*]/.test(target)) {
    return page.locator(target);
  }

  if (/^[a-zA-Z][\w-]*[.#:[>~+]/.test(target)) {
    return page.locator(target);
  }

  if (HTML_TAGS.has(target.toLowerCase())) {
    return page.locator(target);
  }

  return page.getByText(target, { exact: false });
}

function describe(target) {
  if (typeof target === "string") {
    return target;
  }

  return String(target);
}

async function context(page) {
  try {
    return `url=${page.url()}`;
  } catch {
    return "url=<closed>";
  }
}

/** Fails unless at least one matching element is visible. */
export async function expectVisible(page, target, opts = {}) {
  const locator = resolve(page, target).first();
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;

  try {
    await locator.waitFor({ state: "visible", timeout });
  } catch {
    const total = await resolve(page, target).count();
    throw new Error(
      `expectVisible FAILED: "${describe(target)}" never became visible ` +
        `(${total} match${total === 1 ? "" : "es"} in the DOM, none visible within ${timeout}ms) — ${await context(page)}`,
    );
  }

  return locator;
}

/** Fails if any matching element is visible. Matches that exist in the DOM but
 * are hidden PASS — that is the correct state for a `hidden` tab panel. */
export async function expectNotVisible(page, target, opts = {}) {
  const locator = resolve(page, target);
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const deadline = Date.now() + timeout;

  for (;;) {
    const count = await locator.count();
    let visibleIndex = -1;

    for (let index = 0; index < count; index += 1) {
      if (await locator.nth(index).isVisible()) {
        visibleIndex = index;
        break;
      }
    }

    if (visibleIndex === -1) {
      return;
    }

    if (Date.now() > deadline) {
      const text = (
        await locator
          .nth(visibleIndex)
          .innerText()
          .catch(() => "")
      )
        .replace(/\s+/g, " ")
        .slice(0, 120);
      throw new Error(
        `expectNotVisible FAILED: "${describe(target)}" is STILL VISIBLE ` +
          `(match #${visibleIndex}: "${text}") after ${timeout}ms — ${await context(page)}`,
      );
    }

    await page.waitForTimeout(150);
  }
}

/** Fails unless the page's rendered text contains `needle`. Reads innerText
 * (what a human sees), never innerHTML — so a string buried in a comment, an
 * attribute, or a hidden node cannot satisfy or trip it. */
export async function expectText(page, needle, opts = {}) {
  const body = await visibleText(page, opts.within);
  const haystack = opts.caseSensitive ? body : body.toLowerCase();
  const target = opts.caseSensitive ? needle : needle.toLowerCase();

  if (!haystack.includes(target)) {
    throw new Error(
      `expectText FAILED: rendered text does not contain "${needle}" — ${await context(page)}\n` +
        `  saw: ${body.slice(0, 300)}`,
    );
  }
}

/** The inverse — fails if the rendered text contains `needle`. */
export async function expectNoText(page, needle, opts = {}) {
  const body = await visibleText(page, opts.within);
  const haystack = opts.caseSensitive ? body : body.toLowerCase();
  const target = opts.caseSensitive ? needle : needle.toLowerCase();
  const at = haystack.indexOf(target);

  if (at !== -1) {
    throw new Error(
      `expectNoText FAILED: rendered text CONTAINS "${needle}" — ${await context(page)}\n` +
        `  context: …${body.slice(Math.max(0, at - 80), at + 120)}…`,
    );
  }
}

/** Visible text of the page (or of `within`), whitespace-collapsed. */
export async function visibleText(page, within) {
  const locator = within ? resolve(page, within) : page.locator("body");
  const raw = await locator.first().innerText();

  return raw.replace(/\s+/g, " ").trim();
}

/** Fails unless exactly `expected` elements match. */
export async function expectCount(page, target, expected, opts = {}) {
  const locator = resolve(page, target);
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const deadline = Date.now() + timeout;
  let actual = await locator.count();

  while (actual !== expected && Date.now() < deadline) {
    await page.waitForTimeout(150);
    actual = await locator.count();
  }

  if (actual !== expected) {
    throw new Error(
      `expectCount FAILED: "${describe(target)}" matched ${actual}, expected ${expected} — ${await context(page)}`,
    );
  }

  return actual;
}

/** Fails unless at least `min` elements match. */
export async function expectAtLeast(page, target, min, opts = {}) {
  const locator = resolve(page, target);
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const deadline = Date.now() + timeout;
  let actual = await locator.count();

  while (actual < min && Date.now() < deadline) {
    await page.waitForTimeout(150);
    actual = await locator.count();
  }

  if (actual < min) {
    throw new Error(
      `expectAtLeast FAILED: "${describe(target)}" matched ${actual}, expected >= ${min} — ${await context(page)}`,
    );
  }

  return actual;
}

/** Generic escape hatch with the same loud-failure contract. */
export function expectTrue(condition, message) {
  if (!condition) {
    throw new Error(`expectTrue FAILED: ${message}`);
  }
}

/**
 * Scans every <svg> on the page for a non-finite number in any coordinate or
 * path attribute. A `NaN` in an SVG path fails SILENTLY in the browser — the
 * mark simply does not draw, no console error — which is exactly the failure
 * mode of a dual-axis chart whose second domain collapses. Returns the list of
 * offending attributes (empty = clean).
 */
export async function findSvgNaN(page, selector = "svg") {
  return page.$$eval(selector, (svgs) => {
    const COORD = new Set([
      "d",
      "x",
      "y",
      "x1",
      "x2",
      "y1",
      "y2",
      "cx",
      "cy",
      "r",
      "rx",
      "ry",
      "width",
      "height",
      "points",
      "transform",
      "offset",
      "stroke-dasharray",
    ]);
    const bad = [];

    for (const svg of svgs) {
      for (const node of [svg, ...svg.querySelectorAll("*")]) {
        for (const attr of node.attributes) {
          if (!COORD.has(attr.name)) {
            continue;
          }

          if (/NaN|Infinity|undefined|null/i.test(attr.value)) {
            bad.push(
              `<${node.tagName.toLowerCase()} ${attr.name}="${attr.value.slice(0, 120)}">`,
            );
          }
        }
      }
    }

    return bad;
  });
}

/**
 * Every <img> that is in the DOM but failed to load (the broken-image icon).
 * `complete && naturalWidth === 0` is the only reliable signal — a 404'd <img>
 * still renders a box and still reports a layout size.
 */
export async function findBrokenImages(page) {
  return page.$$eval("img", (imgs) =>
    imgs
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.getAttribute("src") ?? "<no src>"),
  );
}
