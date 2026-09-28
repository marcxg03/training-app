import { requireOwner } from "@/lib/auth/requireOwner";
import { getAppToday } from "@/lib/time/server";
import { getAdminAnalytics } from "@/lib/analytics/admin-queries";
import {
  adherencePerWeek,
  daysSinceLastSession,
  muscleGroupCoverage,
  nutritionLoggingRate,
  prsPerWeek,
  sessionsPerWeek,
  sumWeeks,
  volumePerWeek,
  weekStreak,
} from "@/lib/analytics/admin-dashboard";
import { MetricBars, RankedBars } from "@/components/admin/MetricBars";
import { kgToLbs } from "@/lib/units";

/**
 * /admin/analytics — the training-health board (T3-E · D41).
 *
 * SCOPE, STATED ON THE PAGE ITSELF: these are the metrics that are TRUE with
 * one user. `spec/ADMIN_HUB_ANALYTICS.md` also specifies MRR, free→paid
 * conversion, churn and a subscriber×adherence leaderboard — all four read a
 * `subscriptions` table that is not in this schema, and with one account they
 * would render a confident `0` that means nothing at all. A dashboard's whole
 * job is to be trusted; four tiles of decorative zeroes would cost that.
 *
 * Every chart on this board is SINGLE-SERIES. That is a design decision, not a
 * limitation: identity is never carried by hue here, so there is no
 * colourblind-safety question to answer, and magnitude is carried by bar
 * length — the one thing bars are unambiguously good at. No dual axes
 * anywhere; where two measures would have shared a canvas (completed vs
 * prescribed) they are expressed as one derived measure instead (adherence %).
 */

const WEEKS = 12;

function Tile({
  value,
  label,
  sublabel,
  tone = "normal",
}: {
  value: string;
  label: string;
  sublabel?: string;
  tone?: "normal" | "warn";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <span className="eyebrow">{label}</span>
      <span
        className={`text-3xl font-semibold tabular-nums tracking-tight ${
          tone === "warn" ? "text-warning" : "text-foreground"
        }`}
      >
        {value}
      </span>
      {sublabel ? (
        <span className="text-xs text-subtle">{sublabel}</span>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="mb-3 space-y-0.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-subtle">{hint}</p>
      </header>
      {children}
    </section>
  );
}

export default async function AdminAnalyticsPage() {
  const ownerId = await requireOwner();
  const today = await getAppToday();
  const data = await getAdminAnalytics(ownerId, today, WEEKS);

  const sessions = sessionsPerWeek(data.sessions, today, WEEKS);
  const volume = volumePerWeek(data.sets, today, WEEKS);
  const prs = prsPerWeek(data.prs, today, WEEKS);
  const adherence = adherencePerWeek(
    data.sessions,
    data.prescribedPerWeek,
    today,
    WEEKS,
  );
  const coverage = muscleGroupCoverage(data.sets, today, 28);
  const nutrition = nutritionLoggingRate(data.meals, today, 30);
  const streak = weekStreak(data.sessions, today);
  const dormant = daysSinceLastSession(data.sessions, today);
  const thisWeek = adherence.at(-1);

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1.5">
        <p className="eyebrow">Owner · Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Analytics
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Training health over the last {WEEKS} weeks. Marketplace and revenue
          metrics are deliberately absent — there is one account, so they would
          report zeroes that mean nothing.
        </p>
      </header>

      {data.isEmpty ? (
        <p className="rounded-xl border border-dashed border-border bg-card-alt p-5 text-sm text-subtle">
          No training history yet. Complete a session and this board fills in.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          value={String(streak)}
          label="Week streak"
          sublabel={
            streak === 0
              ? "no consecutive weeks yet"
              : "consecutive weeks trained"
          }
        />
        <Tile
          value={dormant === null ? "—" : String(dormant)}
          label="Days since training"
          sublabel={dormant === null ? "never logged a session" : "since the last session"} // prettier-ignore
          tone={dormant !== null && dormant >= 7 ? "warn" : "normal"}
        />
        <Tile
          value={
            data.prescribedPerWeek > 0 && thisWeek
              ? `${thisWeek.completed}/${thisWeek.prescribed}`
              : "—"
          }
          label="This week"
          sublabel={
            data.prescribedPerWeek > 0
              ? "training days / prescribed"
              : "no active plan to compare against"
          }
        />
        <Tile
          value={String(sumWeeks(prs))}
          label="PRs"
          sublabel={`in the last ${WEEKS} weeks`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Training days per week"
          hint={`${sumWeeks(sessions)} training days across ${WEEKS} weeks`}
        >
          <MetricBars
            points={sessions}
            unit="sessions"
            ariaLabel="Training days per week"
            emptyText="No training logged yet"
          />
        </Panel>

        <Panel
          title="Adherence"
          hint={
            data.prescribedPerWeek > 0
              ? `against ${data.prescribedPerWeek} prescribed ${data.prescribedPerWeek === 1 ? "session" : "sessions"} a week`
              : "activate a plan to compare against a prescription"
          }
        >
          <MetricBars
            points={adherence.map((point) => ({
              label: point.label,
              value: point.value,
              hint: `${point.label}: ${point.completed} of ${point.prescribed} sessions${point.extra > 0 ? ` (+${point.extra} extra)` : ""}`, // prettier-ignore
            }))}
            unit="%"
            maxValue={100}
            ariaLabel="Weekly adherence against the prescribed plan"
            format={(v) => `${v}%`}
            emptyText="No prescription to measure against"
          />
        </Panel>

        <Panel
          title="Volume"
          hint="total load moved per week — bodyweight sets count as 0"
        >
          <MetricBars
            points={volume.map((point) => ({
              label: point.label,
              value: Math.round(kgToLbs(point.value)),
            }))}
            unit="lb"
            ariaLabel="Total training volume per week, in pounds"
            format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            emptyText="No sets logged yet"
          />
        </Panel>

        <Panel title="PRs per week" hint="weight and rep PRs combined">
          <MetricBars
            points={prs}
            unit="PRs"
            ariaLabel="Personal records set per week"
            emptyText="No PRs yet"
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Muscle coverage"
          hint="sets that touched each group, last 28 days — a set counts once per group, so these sum to more than your set count"
        >
          <RankedBars
            points={coverage}
            unit="sets"
            ariaLabel="Sets per muscle group over the last 28 days"
            emptyText="No sets in the last 28 days"
          />
        </Panel>

        <Panel
          title="Nutrition logging"
          hint="days with at least one meal logged"
        >
          <div className="flex flex-col gap-2">
            <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {nutrition.days}
              <span className="text-lg text-faint">/{nutrition.window}</span>
            </span>
            <span className="relative h-2 overflow-hidden rounded-full bg-card-alt">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-accent"
                style={{ width: `${nutrition.pct}%` }}
              />
            </span>
            <span className="text-xs text-subtle">
              {nutrition.pct}% of the last {nutrition.window} days
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
