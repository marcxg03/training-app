# SLICE_11_PWA.md

> Slice 11 — Installable PWA + offline shell. Solo-built. No migration, no new
> dependency.

## Goal

Make the app installable (Add to Home Screen, standalone display) and degrade
gracefully offline, without adding a build-time PWA dependency.

## Scope

- `src/app/manifest.ts` → `/manifest.webmanifest`: name "Training", standalone,
  `start_url:/today`, scope `/`, black background/theme, SVG icons (any +
  maskable).
- `public/icon.svg` + `public/icon-maskable.svg` (lilac dumbbell mark).
- Root-layout metadata: `applicationName`, `appleWebApp`, `icons`, and a
  `viewport` export (`themeColor`, `viewportFit: cover`).
- `public/service-worker.js`: hand-rolled, network-first for navigations with a
  cached `/offline` fallback; caches no app/API data (auth + training data stay
  fresh). Named `service-worker.js` because `.gitignore` reserves `sw.js` for
  next-pwa output.
- `src/app/offline/page.tsx`: static, auth-free offline page.
- `src/components/pwa/ServiceWorkerRegistrar.tsx`: client island registering the
  SW on load, mounted once in the root layout.

## Acceptance criteria

1. `/manifest.webmanifest` serves a valid manifest with standalone display,
   start_url, theme/background, and icons.
2. The service worker registers and is active at root scope.
3. Standalone/theme metadata present (theme-color, mobile-web-app-capable,
   apple-mobile-web-app-title/status-bar-style).
4. `/offline` serves as a static fallback; navigations fall back to it offline.
5. No new dependency, no migration. typecheck/lint/format/build clean; no
   console errors.

## Out of scope (FUTURE_WORK)

- Rasterised PNG icons (192/512) + apple-touch-icon PNG.
- Full offline (app-shell precache / cached read-only views).
- Serwist/next-pwa adoption; web push notifications.
