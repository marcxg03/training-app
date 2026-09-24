# `e2e/harness` — authenticated browser drive harness

Every slice ends with a **real browser drive**: click, type, submit, reload, as a
human would. Static gates (typecheck / lint / build) and the pure-function
fixtures have twice shipped bugs that were obvious within seconds of clicking —
a Progress segmented control that never switched (Tailwind `hidden` attribute vs
the `.flex` utility), and a goal-mode control built from `<span>`s with no
handler. This harness exists so that drive is five lines instead of two hundred.

Dependency-free beyond what the repo already installs: `playwright` and
`@supabase/supabase-js`.

---

## Five lines

```js
import {
  startSession,
  createRun,
  expectVisible,
  shoot,
} from "./harness/index.mjs";

const run = createRun("my slice");
let s = null;
try {
  s = await startSession(); // server + user + data + browser
  await run.check("progress renders", async () => {
    await s.go("/progress", "h1");
    await expectVisible(s.page, 'h2:text-is("Recent")');
    await shoot(s.page, "progress");
  });
} finally {
  if (s) await s.stop(); // ALWAYS deletes the test user
}
process.exit(run.report());
```

Run it: `node e2e/drive-<slice>.mjs`. Exit code is non-zero if any check failed.

---

## `startSession(opts)` → session

Does four things, in order, and fails loudly at whichever one breaks:

1. **Dev server.** Polls `http://localhost:3111/login` for a 200. If nothing is
   listening it runs `pnpm exec next dev -p 3111` and waits up to 180 s. It only
   kills a server **it** started — a hand-run `pnpm dev` is left alone.
2. **Auth.** Runs `e2e/_setup/seed-auth.mjs`, which creates (idempotently) a
   confirmed `e2e-slice7b@trainingapp.test` user and returns the exact
   `@supabase/ssr` cookies. No login form, no email round-trip. Then
   `prep-profile.mjs`.
3. **Data** (`seedData: true`, the default). `seed-analytics-data.mjs`
   (6 weeks of set_logs across 3 exercises, 30 days of meals, targets) then
   `seed-pr-history.mjs` (the `workout_completions` + `pr_history` rows every PR
   surface joins through). Both refuse to run against anything that is not an
   `@trainingapp.test` account.
4. **Browser.** Chromium, one context with the auth cookies injected, console +
   pageerror capture attached before the first navigation.

| option     | default    |                                           |
| ---------- | ---------- | ----------------------------------------- |
| `seedData` | `true`     | set `false` for empty-state drives        |
| `viewport` | `"mobile"` | `"mobile"` 390×844 · `"desktop"` 1280×900 |
| `headless` | `true`     | or `E2E_HEADED=1`                         |
| `slowMo`   | `0`        | or `E2E_SLOWMO=250` to watch it           |

### What the session gives you

|                                    |                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page`, `context`, `browser`       | the Playwright objects                                                                                                                                              |
| `userId`, `email`, `cookies`       | the throwaway account                                                                                                                                               |
| `seed`                             | `{ prs, weightPRs, repPRs, completions, topExerciseId, topExerciseName, topExercisePRs }` — navigate straight to an exercise that has data                          |
| `admin`                            | service-role Supabase client, for fixtures and source-of-truth assertions                                                                                           |
| `baseUrl`                          | `http://localhost:3111`                                                                                                                                             |
| `console`                          | `{ errors: [], noise: [] }`, filled as the drive runs                                                                                                               |
| `go(path, waitFor?)`               | navigate + `networkidle` + optional readiness locator. **Throws on a ≥500** rather than letting it surface three assertions later as "element never became visible" |
| `setViewport("mobile"\|"desktop")` |                                                                                                                                                                     |
| `stop()`                           | close browser **and** run `cleanup-auth.mjs`. Call it in a `finally`                                                                                                |
| `verifyCleanedUp()`                | `true` if the test user is really gone. Call **after** `stop()`                                                                                                     |

### Safety

`e2e/harness/env.mjs` exports `assertTestUser(userId)`, which throws unless the
id belongs to an `@trainingapp.test` account; `startSession` calls it before any
seeding. Marcus's real account (`04d5d1d4-…`) can never match. Every seed script
repeats the gate independently.

---

## Assertions — they throw with a diagnosable message

From `assert.mjs` (all re-exported by `index.mjs`):

|                                                                   |                                                                                                                                                                                         |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expectVisible(page, target, {timeout})`                          | fails unless a match is **painted**                                                                                                                                                     |
| `expectNotVisible(page, target, {timeout})`                       | a match that exists but is hidden **passes** — the correct state for a `hidden` tab panel                                                                                               |
| `expectText(page, needle)` / `expectNoText(page, needle)`         | against `innerText` (what a human sees), never `innerHTML` — a string in a comment or attribute can neither satisfy nor trip these                                                      |
| `expectCount(page, target, n)` / `expectAtLeast(page, target, n)` |                                                                                                                                                                                         |
| `expectTrue(cond, message)`                                       | escape hatch, same loud contract                                                                                                                                                        |
| `visibleText(page, within?)`                                      | whitespace-collapsed rendered text                                                                                                                                                      |
| `findSvgNaN(page, selector?)`                                     | every non-finite value in an SVG coordinate/path attribute. **A `NaN` in a path fails silently in the browser** — no draw, no console error — which is the dual-axis chart failure mode |
| `findBrokenImages(page)`                                          | every `<img>` that is `complete && naturalWidth === 0`, i.e. the broken-image icon                                                                                                      |

**Target resolution.** A target is a Playwright `Locator`, an engine-prefixed
string (`css=`, `text=`, `xpath=`, `//…`), a CSS/Playwright selector, or plain
visible text. The rules, in order: an engine prefix wins; `.foo` `#foo` `[attr]`
`*` is CSS; `tag` followed by `. # : [ > ~ +` is CSS (this is what makes
`h2:text-is("Recent")` and `svg[aria-label="…"]` work); a bare word that is a
known HTML tag is CSS; **everything else is text**. When in doubt, prefix it
(`css=…`) or pass a Locator.

Assert on **visibility**, not on an active-pill class. A styling assertion is
exactly what let the broken segmented control through.

---

## Console capture

Attached to `page` before the first navigation: `console` errors, `pageerror`,
and real `requestfailed`s. `next dev` noise (cold-compile chunk 404s,
`ChunkLoadError`, Fast Refresh, DevTools nags, the Fontshare stylesheet, service
worker registration) is filtered into `session.console.noise` — **kept, not
discarded** — and reported as a count. Everything else lands in
`session.console.errors`. `printConsoleReport(session.console)` prints both.

---

## Screenshots

`shoot(page, name)` → `/tmp/drive-<name>-<viewport>.png` (override the directory
with `E2E_SHOT_DIR`). `screenshots()` returns everything taken this run, for the
report footer.

---

## The runner

`createRun(title)` returns:

- `check(name, async fn)` — runs it, catches whatever it throws, records
  PASS/FAIL, and **keeps going**. One broken assertion must not hide the other
  nine. Return a string to annotate the PASS row.
- `record(name, "PASS"|"FAIL"|"SKIP", detail)` — for facts established outside a
  browser assertion: an HTTP probe, a DB read, or an honest _"this could not be
  exercised headlessly"_ SKIP.
- `section(label)`, `report()` → the PASS/FAIL table and an exit code.

---

## Gotchas found the hard way

- **The logger has no `<h1>`.** Single-block focus puts the block label in the
  top bar. Use `text=/Which exercise today|Today's exercise/` as its readiness
  signal — and note the copy changes once an exercise is selected for the block.
- **The logger only opens today's workout.** A drive that needs it must build an
  active plan on the app-day weekday (read the profile's `timezone`, don't
  assume). Keep exactly **one** active plan or Today's `maybeSingle()` schedule
  lookup throws.
- **`seed-analytics-data.mjs` creates no PRs and no completions** — it is a chart
  fixture. `seed-pr-history.mjs` adds both; `getPRTimeline` discards any PR whose
  `achieved_at` falls outside a `workout_completions` window.
- **`MODULE_NOT_FOUND ./1234.js` in the dev-server log = a stale `.next`.** Stop
  the server, `rm -rf .next`, start it again. It presents as a blanket 500 on
  pages that compile fine.
- Text matching is **not** affected by `text-transform: uppercase` (the
  `.eyebrow` class), but `visibleText()` / `expectNoText()` read `innerText`,
  which **is**. Compare case-insensitively (the default).
