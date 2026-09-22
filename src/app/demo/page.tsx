import { Button } from "@/components/ui/button";

/**
 * /demo — a no-auth visual test harness for the mono reskin.
 * Renders the design-system tokens + representative composed elements so the
 * reskin can be driven/screenshotted in a real browser without a Supabase login.
 * NOT part of the product surface; delete or gate before shipping to users.
 */

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

function MacroBar({
  label,
  pct,
  state,
}: {
  label: string;
  pct: number;
  state: "under" | "in" | "over";
}) {
  const fill =
    state === "in"
      ? "bg-success"
      : state === "under"
        ? "bg-warning"
        : "bg-danger";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="uppercase tracking-wider text-faint">{label}</span>
        <span className="capitalize tabular-nums text-subtle">{state}</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-input">
        {/* target range band */}
        <div className="absolute inset-y-0 left-[45%] right-[20%] bg-border" />
        <div
          className={`absolute inset-y-0 left-0 ${fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function DemoPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
            ⚡
          </div>
          <h1 className="text-lg font-semibold">Training — Mono Reskin Demo</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Visual test harness (/demo). Tokens + composed elements in the
          minimalist-mono system.
        </p>
      </header>

      <Section title="Palette">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          <Swatch name="background" className="bg-background" />
          <Swatch name="card" className="bg-card" />
          <Swatch name="card-alt" className="bg-card-alt" />
          <Swatch name="input" className="bg-input" />
          <Swatch name="border" className="bg-border" />
          <Swatch name="muted-fg" className="bg-muted-foreground" />
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

      <Section title="Form">
        <div className="flex flex-col gap-3">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-faint">
            Email
          </label>
          <input
            className="h-11 rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="marcus@example.com"
            readOnly
          />
          <div className="flex items-center gap-2 text-sm text-subtle">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-border bg-accent text-xs text-accent-foreground">
              ✓
            </span>
            Taken to failure
          </div>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">
            PR ▲
          </span>
          <span className="rounded-full bg-success/15 px-2 py-0.5 font-medium text-success">
            In range
          </span>
          <span className="rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning">
            Under
          </span>
          <span className="rounded-full bg-danger/15 px-2 py-0.5 font-medium text-danger">
            Over
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
            Failure
          </span>
          <span className="rounded-full bg-cardio/15 px-2 py-0.5 font-medium text-cardio">
            Cardio
          </span>
        </div>
      </Section>

      <Section title="Set scheme — warm-up + working sets">
        <p className="-mt-2 text-xs text-muted-foreground">
          Every set is a warm-up or a working set. Working sets default to 2,
          but you can add a 3rd or 4th any day — the count is a target, not a
          cap.
        </p>
        <div className="flex flex-col gap-2">
          {[
            { label: "Warm-up", detail: "optional" },
            { label: "Working 1", detail: "target" },
            { label: "Working 2", detail: "target" },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                {row.label}
              </span>
              <span className="text-sm tabular-nums text-foreground">
                225 lbs × 6
              </span>
              <span className="text-xs text-muted-foreground">
                {row.detail}
              </span>
            </div>
          ))}
          <button className="rounded-md border border-dashed border-border px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:bg-muted">
            + Add working set
          </button>
        </div>
      </Section>

      <Section title="Nutrition — range vs range">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
          <MacroBar label="Calories" pct={62} state="in" />
          <MacroBar label="Protein" pct={38} state="under" />
          <MacroBar label="Carbs" pct={88} state="over" />
        </div>
      </Section>

      <Section title="Today card">
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Lift
              </span>
              <span className="text-sm font-semibold">Monday · Upper</span>
            </div>
            <span className="text-xs text-muted-foreground">
              9 blocks · 3 rounds
            </span>
          </div>
          <Button size="sm">Start ▸</Button>
        </div>
      </Section>

      <Section title="Bottom tab bar">
        <div className="flex items-center justify-around rounded-lg border border-border bg-card-alt px-2 py-3 text-[10px] uppercase tracking-wider">
          {["Today", "Plan", "Library", "History", "Nutrition"].map(
            (tab, i) => (
              <span
                key={tab}
                className={i === 0 ? "text-accent" : "text-muted-foreground"}
              >
                {tab}
              </span>
            ),
          )}
        </div>
      </Section>
    </main>
  );
}
