# Reskin Checkpoint — 2026-09-22 (approved by Marcus)

**Direction locked:** light theme (white bg / near-black accent), **Satoshi** font (Fontshare), semantic colors deepened for white-bg legibility (kept green/amber/red/teal identities), set-scheme = **warm-up + working sets** (working count a target, not a cap; "+ add working set"; to-failure is an optional per-set toggle, not a set type).

**Tokens** live in `src/app/globals.css` `:root` (+ `--accent-foreground`); font wired in `src/app/layout.tsx` (Fontshare `<link>`) + `tailwind.config.ts` (`sans`/`display` → Satoshi first). Demo route: `/demo` (no-auth harness). Screenshot harness: `scripts/screenshot-route.mjs`.

**Snapshots:** `demo-checkpoint-2026-09-22-{desktop,mobile}.png`, `login-checkpoint-2026-09-22-desktop.png`.

**Git tag:** `reskin-demo-checkpoint`.
