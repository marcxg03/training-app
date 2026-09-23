import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";

/**
 * /demo — a no-auth visual test harness.
 * Section 1: SCREEN DESIGNS — live phone-frame mockups of each tab (the
 *   collaborative redesign; static markup, real tokens/components).
 * Section 2: the design-system tokens + primitives (reference).
 * NOT part of the product surface; gated out of production below.
 */

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function PhoneFrame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      <div className="w-[390px] max-w-full overflow-hidden rounded-[2rem] border-[6px] border-foreground/90 bg-background shadow-xl">
        <div className="flex h-[780px] flex-col">{children}</div>
      </div>
    </div>
  );
}

function BottomNav({ active }: { active: string }) {
  const tabs: [string, string][] = [
    ["Today", "◎"],
    ["Plan", "▤"],
    ["Nutrition", "◍"],
    ["Progress", "◹"],
    ["Community", "◇"],
  ];
  return (
    <nav className="mt-auto flex items-center justify-around border-t border-border bg-card px-1 py-2">
      {tabs.map(([tab, icon]) => {
        const on = tab === active;
        return (
          <span
            key={tab}
            className={`flex flex-col items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider ${
              on ? "text-accent" : "text-faint"
            }`}
          >
            <span className="text-base leading-none">{icon}</span>
            {tab}
          </span>
        );
      })}
    </nav>
  );
}

function MacroBar({
  label,
  pct,
  state,
  value,
}: {
  label: string;
  pct: number;
  state: "under" | "in" | "over";
  value: string;
}) {
  const fill =
    state === "in" ? "bg-success" : state === "under" ? "bg-warning" : "bg-danger";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="uppercase tracking-wider text-faint">{label}</span>
        <span className="tabular-nums text-subtle">{value}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-input">
        <div className="absolute inset-y-0 left-[45%] right-[18%] bg-border" />
        <div
          className={`absolute inset-y-0 left-0 ${fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 1 — TODAY (calm glanceable overview, focal Start card)      */
/* ------------------------------------------------------------------ */

function TodayScreen() {
  return (
    <PhoneFrame label="Today">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 pt-6">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
              Monday · Sep 22
            </span>
            <span className="text-xl font-bold tracking-tight">Upper Day</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-input text-sm font-semibold text-subtle">
            MG
          </div>
        </div>

        {/* FOCAL start card — the one dominant element */}
        <div className="flex flex-col gap-4 rounded-2xl bg-accent p-5 text-accent-foreground">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-accent-foreground/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              Lift · Now
            </span>
            <span className="text-[11px] tabular-nums text-accent-foreground/60">
              ~55 min
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-bold tracking-tight">Upper</span>
            <span className="text-[13px] text-accent-foreground/70">
              9 blocks · 3 rounds · back → chest → shoulders
            </span>
          </div>
          <button className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-foreground text-sm font-bold uppercase tracking-wider text-accent">
            Start Workout ▸
          </button>
        </div>

        {/* quiet day summary — also on today */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
            Also today
          </span>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-cardio">◍</span>
              <span className="flex-1 text-sm">Plyos + Track</span>
              <span className="text-[11px] tabular-nums text-faint">
                4 plyo · 4×400m
              </span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-subtle">☾</span>
              <span className="flex-1 text-sm text-subtle">Sleep 7.5h</span>
              <span className="text-[11px] uppercase tracking-wider text-success">
                Ready
              </span>
            </div>
          </div>
        </div>

        {/* fuel glance */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
              Nutrition · lifting day
            </span>
            <span className="text-[11px] font-medium text-accent">Log meal +</span>
          </div>
          <MacroBar label="Cals" pct={62} state="in" value="1980 / 2400" />
          <MacroBar label="Protein" pct={40} state="under" value="82 / 180g" />
          <MacroBar label="Carbs" pct={70} state="in" value="210 / 300g" />
        </div>

        {/* week strip */}
        <div className="flex items-center justify-between px-1">
          {[
            ["M", true],
            ["T", false],
            ["W", false],
            ["T", false],
            ["F", false],
            ["S", false],
            ["S", false],
          ].map(([d, on], i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase text-faint">{d}</span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                  on
                    ? "bg-accent text-accent-foreground"
                    : "bg-input text-subtle"
                }`}
              >
                {22 + i}
              </span>
            </div>
          ))}
        </div>
      </div>
      <BottomNav active="Today" />
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 2 — LOGGER (flagship hot path)                              */
/* ------------------------------------------------------------------ */

function LoggerSetRow({
  label,
  value,
  role,
  pr,
}: {
  label: string;
  value: string;
  role: "done" | "active" | "target";
  pr?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        role === "active"
          ? "border-accent bg-card"
          : role === "done"
            ? "border-border bg-card"
            : "border-dashed border-border bg-transparent"
      }`}
    >
      <span
        className={`w-16 text-[11px] font-semibold uppercase tracking-wider ${
          role === "target" ? "text-faint" : "text-subtle"
        }`}
      >
        {label}
      </span>
      <span
        className={`flex-1 text-lg tabular-nums ${
          role === "target" ? "text-faint" : "font-semibold text-foreground"
        }`}
      >
        {value}
      </span>
      {pr && (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
          PR ▲
        </span>
      )}
      {role === "done" && !pr && <span className="text-success">✓</span>}
    </div>
  );
}

function LoggerScreen() {
  return (
    <PhoneFrame label="Logger">
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* sticky-ish top: progress + sync */}
        <div className="flex flex-col gap-3 border-b border-border bg-card px-4 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <button className="text-[13px] text-muted-foreground">✕ End</button>
            <div className="flex items-center gap-1.5 text-[11px] text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Synced
            </div>
          </div>
          {/* block progress dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i < 2 ? "bg-accent" : i === 2 ? "bg-accent/40" : "bg-input"
                }`}
              />
            ))}
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
              Block 3 / 9 · Shoulders
            </span>
            <span className="text-[11px] tabular-nums text-faint">
              R1 · Overhead
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 px-4 py-4">
          {/* exercise pick (bank) */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight">
                Overhead Press
              </span>
              <span className="text-[11px] text-muted-foreground">
                target 6–8 · 2 working sets
              </span>
            </div>
            <button className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
              Swap
            </button>
          </div>

          {/* logged + target sets */}
          <div className="flex flex-col gap-2">
            <LoggerSetRow label="Warm-up" value="95 lbs × 10" role="done" />
            <LoggerSetRow label="Work 1" value="135 lbs × 8" role="done" pr />
            <LoggerSetRow label="Work 2" value="— " role="active" />
          </div>

          {/* BIG entry pad for the active set */}
          <div className="flex flex-col gap-3 rounded-2xl border border-accent bg-card p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-1 rounded-xl bg-input py-3">
                <span className="text-[10px] uppercase tracking-wider text-faint">
                  Weight (lbs)
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xl text-subtle">−</span>
                  <span className="text-2xl font-bold tabular-nums">135</span>
                  <span className="text-xl text-subtle">+</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl bg-input py-3">
                <span className="text-[10px] uppercase tracking-wider text-faint">
                  Reps
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xl text-subtle">−</span>
                  <span className="text-2xl font-bold tabular-nums">7</span>
                  <span className="text-xl text-subtle">+</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-subtle">
              <span className="flex h-5 w-5 items-center justify-center rounded border border-border text-[10px]">
                ✓
              </span>
              Taken to failure
            </div>
            <Button className="h-12 w-full text-sm font-bold uppercase tracking-wider">
              Log Work 2
            </Button>
          </div>

          {/* flexible scheme actions */}
          <div className="flex gap-2">
            <button className="flex-1 rounded-xl border border-dashed border-border py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              + Add working set
            </button>
            <button className="flex-1 rounded-xl bg-accent py-3 text-[11px] font-bold uppercase tracking-wider text-accent-foreground">
              Complete block ▸
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 3 — FUEL (nutrition: range-vs-range + meal log + AI est.)   */
/* ------------------------------------------------------------------ */

function FuelScreen() {
  return (
    <PhoneFrame label="Nutrition">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 pt-6">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
              Monday · Nutrition
            </span>
            <span className="text-xl font-bold tracking-tight">Lifting Day</span>
          </div>
          <span className="rounded-full bg-input px-3 py-1 text-[11px] font-medium text-subtle">
            Maintain
          </span>
        </div>

        {/* calories headline — the one number that matters */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-end justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                Calories
              </span>
              <span className="text-3xl font-bold tabular-nums">
                1,980
                <span className="text-base font-medium text-faint">
                  {" "}
                  / 2,200–2,400
                </span>
              </span>
            </div>
            <span className="rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success">
              In range
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <MacroBar label="Protein" pct={40} state="under" value="82 / 180g" />
            <MacroBar label="Carbs" pct={72} state="in" value="210 / 300g" />
            <MacroBar label="Fat" pct={58} state="in" value="52 / 80g" />
          </div>
        </div>

        {/* meal log */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
            Today's meals
          </span>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {[
              ["Breakfast", "Oats · eggs · berries", "620", true],
              ["Lunch", "Chicken bowl", "740", true],
              ["Snack", "Greek yogurt", "220", false],
            ].map(([meal, desc, cals, photo]) => (
              <div key={meal as string} className="flex items-center gap-3 px-4 py-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs ${
                    photo ? "bg-accent text-accent-foreground" : "bg-input text-faint"
                  }`}
                >
                  {photo ? "▣" : "◍"}
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold">{meal}</span>
                  <span className="text-[11px] text-muted-foreground">{desc}</span>
                </div>
                <span className="text-sm tabular-nums text-subtle">{cals}</span>
              </div>
            ))}
          </div>
        </div>

        {/* log flow — AI estimator + manual */}
        <div className="flex flex-col gap-2">
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-[12px] font-bold uppercase tracking-wider text-accent-foreground">
            ▣ Snap a meal
          </button>
          <div className="flex gap-2">
            <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-3.5 text-[12px] font-bold uppercase tracking-wider text-subtle">
              ✎ Describe
            </button>
            <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-3.5 text-[12px] font-bold uppercase tracking-wider text-subtle">
              ⌨ Log manually
            </button>
          </div>
          <p className="px-1 text-[11px] leading-relaxed text-faint">
            Snap or describe → AI estimates macros (photo &amp; text saved with the
            meal). Or enter P/C/F yourself — calories auto-derive.
          </p>
        </div>
      </div>
      <BottomNav active="Nutrition" />
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 4 — PLAN (view-only on mobile: active plan + the week)      */
/* ------------------------------------------------------------------ */

function PlanScreen() {
  const week: [string, string, string, "lift" | "sport" | "cond" | "rest"][] = [
    ["Mon", "Upper", "Plyos + Track", "lift"],
    ["Tue", "Lower", "Power + Strength", "lift"],
    ["Wed", "Basketball", "1–2 h", "sport"],
    ["Thu", "Push", "Cardio AM", "lift"],
    ["Fri", "Pull", "+ Basketball", "lift"],
    ["Sat", "HYROX", "half or full", "cond"],
    ["Sun", "ATG Recovery", "+ cardio", "rest"],
  ];
  const dot = {
    lift: "bg-accent",
    sport: "bg-warning",
    cond: "bg-cardio",
    rest: "bg-border",
  };
  return (
    <PhoneFrame label="Plan">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 pt-6">
        {/* header */}
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
          Active plan
        </span>

        {/* plan selector — tappable; mobile user can switch/load a plan */}
        <button className="flex items-center justify-between rounded-xl border border-accent bg-card px-4 py-3.5 text-left">
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight">Block II</span>
            <span className="text-[11px] text-muted-foreground">
              Sep–Dec · your plan
            </span>
          </div>
          <span className="rounded-lg bg-input px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
            Switch ⌄
          </span>
        </button>

        {/* mini plan list revealed on switch — your plans + subscribed */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card-alt p-2">
          {[
            ["Block II", "Sep–Dec · your plan", true],
            ["Block I — Hybrid HYROX", "archived", false],
            ["Push On · Base (Merk)", "subscribed", false],
          ].map(([name, sub, active]) => (
            <div
              key={name as string}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                active ? "bg-accent text-accent-foreground" : "bg-card"
              }`}
            >
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold">{name}</span>
                <span
                  className={`text-[10px] uppercase tracking-wider ${
                    active ? "text-accent-foreground/60" : "text-faint"
                  }`}
                >
                  {sub}
                </span>
              </div>
              {active ? (
                <span className="text-[11px]">✓ Active</span>
              ) : (
                <span className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">
                  Load
                </span>
              )}
            </div>
          ))}
        </div>

        {/* the week */}
        <div className="flex flex-col gap-2">
          {week.map(([day, name, sub, kind], i) => {
            const today = i === 0;
            return (
              <div
                key={day}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 ${
                  today ? "border-accent bg-card" : "border-border bg-card"
                }`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot[kind]}`} />
                <div className="flex w-10 shrink-0 flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                    {day}
                  </span>
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold">{name}</span>
                  <span className="text-[11px] text-muted-foreground">{sub}</span>
                </div>
                {today && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                    Today
                  </span>
                )}
                <span className="text-faint">›</span>
              </div>
            );
          })}
        </div>

        {/* boundary note: switch/load here, build on desktop */}
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-[11px] text-muted-foreground">
          <span className="text-faint">✎</span>
          Switch or load any plan here. Building &amp; editing lives on the desktop
          app.
        </div>
      </div>
      <BottomNav active="Plan" />
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 5 — PROGRESS (merged: PRs + history + per-exercise charts)  */
/* ------------------------------------------------------------------ */

function ProgressScreen() {
  const bars = [40, 46, 52, 50, 58, 64, 62, 70]; // OHP top-set trend
  return (
    <PhoneFrame label="Progress">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 pt-6">
        {/* header + segmented */}
        <div className="flex flex-col gap-3">
          <span className="text-xl font-bold tracking-tight">Progress</span>
          <div className="flex rounded-lg bg-input p-1 text-[11px] font-semibold uppercase tracking-wider">
            {["Overview", "By exercise", "History"].map((t, i) => (
              <span
                key={t}
                className={`flex-1 rounded-md py-1.5 text-center ${
                  i === 0 ? "bg-card text-foreground shadow-sm" : "text-faint"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* stat row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            ["12", "workouts", "this month"],
            ["5", "PRs", "this month"],
            ["9", "day streak", "current"],
          ].map(([n, label, sub]) => (
            <div
              key={label}
              className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-card py-3"
            >
              <span className="text-2xl font-bold tabular-nums">{n}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                {label}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-faint">
                {sub}
              </span>
            </div>
          ))}
        </div>

        {/* per-exercise chart */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold">Overhead Press</span>
              <span className="text-[11px] text-muted-foreground">
                top working set · lbs
              </span>
            </div>
            <span className="rounded-md bg-input px-2 py-1 text-[11px] font-medium text-subtle">
              Change ⌄
            </span>
          </div>
          <div className="flex h-24 items-end gap-1.5">
            {bars.map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t ${
                  i === bars.length - 1 ? "bg-accent" : "bg-border"
                }`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] tabular-nums text-faint">
            <span>95</span>
            <span className="font-semibold text-accent">135 · PR ▲</span>
          </div>
        </div>

        {/* recent timeline — sessions + PRs interleaved */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
            Recent
          </span>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {[
              ["pr", "Overhead Press", "135 × 8 — weight PR", "Today"],
              ["session", "Upper", "9 blocks · 2 PRs", "Today"],
              ["session", "Pull + Basketball", "6 blocks", "Fri"],
              ["pr", "Deadlift", "315 × 5 — rep PR", "Tue"],
            ].map(([kind, name, sub, when], i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs ${
                    kind === "pr"
                      ? "bg-accent text-accent-foreground"
                      : "bg-input text-subtle"
                  }`}
                >
                  {kind === "pr" ? "▲" : "✓"}
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold">{name}</span>
                  <span className="text-[11px] text-muted-foreground">{sub}</span>
                </div>
                <span className="text-[11px] uppercase tracking-wider text-faint">
                  {when}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav active="Progress" />
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* SCREEN 6 — COMMUNITY (follower shell: storefront + programs + feed)*/
/* ------------------------------------------------------------------ */

function CommunityScreen() {
  return (
    <PhoneFrame label="Community">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 pt-6">
        {/* header + segmented */}
        <div className="flex flex-col gap-3">
          <span className="text-xl font-bold tracking-tight">Community</span>
          <div className="flex rounded-lg bg-input p-1 text-[11px] font-semibold uppercase tracking-wider">
            {["Discover", "Feed"].map((t, i) => (
              <span
                key={t}
                className={`flex-1 rounded-md py-1.5 text-center ${
                  i === 0 ? "bg-card text-foreground shadow-sm" : "text-faint"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* featured creator program (storefront) */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex h-28 items-end bg-accent p-4">
            <div className="flex flex-col text-accent-foreground">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent-foreground/60">
                By Marcus Gao
              </span>
              <span className="text-lg font-bold">Block II — Hybrid HYROX</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground">
                7-day · lift + HYROX · nutrition included
              </span>
              <span className="text-[11px] font-medium text-subtle">
                128 training now
              </span>
            </div>
            <button className="rounded-xl bg-accent px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-accent-foreground">
              Subscribe · Free
            </button>
          </div>
        </div>

        {/* more programs */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
            More programs
          </span>
          {[
            ["Base Builder", "Strength · 4-day", "Free"],
            ["Cut Season", "Fat-loss · nutrition-led", "$15/mo"],
          ].map(([name, sub, price]) => (
            <div
              key={name}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="h-12 w-12 shrink-0 rounded-lg bg-input" />
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-semibold">{name}</span>
                <span className="text-[11px] text-muted-foreground">{sub}</span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                {price}
              </span>
            </div>
          ))}
        </div>

        {/* 1-on-1 coaching inquiry — FUTURE build (lead capture, not CRM) */}
        <button className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card-alt px-4 py-3.5 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-input text-sm">
            ✦
          </span>
          <div className="flex flex-1 flex-col">
            <span className="text-[13px] font-semibold">
              Train 1-on-1 with Marcus
            </span>
            <span className="text-[11px] text-muted-foreground">
              Limited spots · inquire to apply
            </span>
          </div>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
            Soon
          </span>
        </button>

        {/* feed peek — accountability, not CRM */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-faint">
            From the feed
          </span>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-input" />
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold">Jordan · Block II</span>
                <span className="text-[10px] uppercase tracking-wider text-faint">
                  Day 9 · Upper
                </span>
              </div>
            </div>
            <p className="text-[13px] text-subtle">
              First bodyweight dip PR today 🔥 this block is working.
            </p>
            <div className="flex items-center gap-4 text-[11px] text-faint">
              <span className="text-accent">♥ 12 support</span>
              <span>◇ 3</span>
            </div>
          </div>
        </div>
      </div>
      <BottomNav active="Community" />
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Reference: tokens + primitives (kept below the screens)           */
/* ------------------------------------------------------------------ */

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className={`h-12 rounded-md border border-border ${className}`} />
      <span className="text-[10px] uppercase tracking-wider text-faint">
        {name}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DemoPage() {
  // Dev-only design harness — never expose it on the production deploy.
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
            ⚡
          </div>
          <h1 className="text-lg font-semibold">Training — Redesign Screens</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Live phone-frame mockups (light + Satoshi). Today = calm glanceable
          overview with one focal Start card; Logger = flagship hot path.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Screen designs
        </h2>
        <div className="flex flex-wrap justify-center gap-10">
          <TodayScreen />
          <LoggerScreen />
          <FuelScreen />
          <PlanScreen />
          <ProgressScreen />
          <CommunityScreen />
        </div>
      </section>

      <hr className="border-border" />

      <p className="text-[11px] uppercase tracking-[0.15em] text-faint">
        Reference — tokens &amp; primitives
      </p>

      <Section title="Palette">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          <Swatch name="background" className="bg-background" />
          <Swatch name="card" className="bg-card" />
          <Swatch name="card-alt" className="bg-card-alt" />
          <Swatch name="input" className="bg-input" />
          <Swatch name="border" className="bg-border" />
          <Swatch name="accent" className="bg-accent" />
          <Swatch name="success" className="bg-success" />
          <Swatch name="warning" className="bg-warning" />
          <Swatch name="danger" className="bg-danger" />
          <Swatch name="cardio" className="bg-cardio" />
          <Swatch name="foreground" className="bg-foreground" />
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>
    </main>
  );
}
