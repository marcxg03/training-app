// Console + pageerror capture.
//
// Next's dev server is noisy in ways that say nothing about the app: a cold
// compile can 404 a chunk that exists a second later, React DevTools nags, HMR
// chatters. Those are filtered so a real app error is never buried. Everything
// filtered is still KEPT (as `noise`) and reported separately — a drive should
// never silently discard evidence.

const NOISE_PATTERNS = [
  // Cold-compile / HMR artifacts of `next dev`.
  /Failed to load resource.*_next\/static/i,
  /ChunkLoadError/i,
  /hot-reloader/i,
  /\[Fast Refresh\]/i,
  /webpack-hmr/i,
  // Browser/devtools chatter, not the app.
  /Download the React DevTools/i,
  /Lighthouse/i,
  /favicon/i,
  // Fontshare stylesheet is an external host the CSP may refuse in dev.
  /api\.fontshare\.com/i,
  // next-pwa / service worker registration noise on localhost.
  /ServiceWorker|service-worker|sw\.js/i,
];

export function attachConsoleCapture(page, sink) {
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") {
      return;
    }

    const text = message.text();
    const entry = {
      kind: message.type(),
      text,
      url: page.url(),
      location: message.location?.()?.url ?? "",
    };

    if (message.type() === "warning") {
      sink.noise.push(entry);
      return;
    }

    (NOISE_PATTERNS.some((re) => re.test(text))
      ? sink.noise
      : sink.errors
    ).push(entry);
  });

  page.on("pageerror", (error) => {
    sink.errors.push({
      kind: "pageerror",
      text: error?.message ?? String(error),
      stack: error?.stack ?? "",
      url: page.url(),
    });
  });

  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";

    // Aborted navigations are routine (client-side routing races); only real
    // network failures matter.
    if (/ERR_ABORTED|NS_BINDING_ABORTED/i.test(failure)) {
      return;
    }

    const entry = {
      kind: "requestfailed",
      text: `${failure} ${request.url()}`,
      url: page.url(),
    };

    (NOISE_PATTERNS.some((re) => re.test(entry.text))
      ? sink.noise
      : sink.errors
    ).push(entry);
  });
}

export function createSink() {
  return { errors: [], noise: [] };
}

export function printConsoleReport(sink) {
  console.log("\nCONSOLE");

  if (sink.errors.length === 0) {
    console.log("  no app-level console errors or page errors");
  } else {
    for (const entry of sink.errors) {
      console.log(`  [${entry.kind}] ${entry.text}`);
      console.log(`      on ${entry.url}`);
    }
  }

  if (sink.noise.length) {
    console.log(
      `  (${sink.noise.length} filtered dev-server/browser warning${sink.noise.length === 1 ? "" : "s"}: ` +
        `${[...new Set(sink.noise.map((n) => n.text.slice(0, 60)))].slice(0, 4).join(" | ")})`,
    );
  }
}
