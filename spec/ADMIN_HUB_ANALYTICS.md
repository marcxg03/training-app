# Admin Hub Analytics Spec — Solo Fitness Creator App

> Build-spec input for the **owner-only desktop admin hub** (deferred build). Research 2026-09-22.
> The admin hub is where Marcus creates/edits/archives/publishes programs AND sees app analytics.
> Through-line: instrument the **vital few** first; a solo owner drowns in a 40-metric dashboard.
> ~80% of v1 is computable from **existing Supabase tables** — no analytics SaaS required for v1.

## 0. Framing — four questions the hub must answer
1. **Is the core product healthy?** (do people log workouts and come back?)
2. **Is the marketplace working?** (do subscribers convert, stick to programs, stay?)
3. **Is the money real and growing?** (MRR, churn, LTV)
4. **Is the machine up?** (technical/operational guardrail)

**North Star = Weekly Active Loggers** (users who logged ≥1 workout in last 7d).
**Aha / activation moment = first full workout completed** (Day 1). Instrument backwards from these.

## 1. Product-health
- **Activation rate** + **time-to-activate** — % of new signups who log first full workout within 24–48h; median hours to it.
- **Onboarding funnel** — signup → onboarding done → plan loaded → first workout. Biggest leak is usually plan-loaded → first-workout.
- **WAU/MAU** (lead with WAU — people train 3–6×/wk, not daily) + **stickiness (WAU/MAU)**.
- **Session/log frequency** — median workouts/active user/week (truest engagement signal).
- **D1/D7/D30 retention** by signup cohort; **cohort retention heatmap** (later cohorts should sit higher).
- **Feature adoption** — logger-usage rate (~100% expected), nutrition-logging rate, **AI-photo vs manual meal share**, **streak distribution** histogram.
- **Churn signals (leading)** — **dormancy flag** (0 logs in 14d — single most useful early warning), declining-frequency flag (weekly logs down >50% vs trailing 4-wk avg).

## 2. Creator / marketplace
- **Subscribers per program** (free vs paid); **subscriber growth** (net/week).
- **Plan-load → first-workout conversion** (the marketplace activation gate).
- **Program completion / adherence rate** — logged ÷ prescribed sessions. *This tells you which programs are good, separate from how many bought.*
- **Program retention vs churn** — rank programs by retained-subscriber-months, not signups.
- **Free → paid conversion** + time-to-upgrade. Benchmarks: H&F trial→paid ~35% median; hard paywall ~5× freemium; freemium free→paid = low single digits.
- **Coaching-inquiry funnel** (future) — subscribers → inquiry → call booked. Highest-ARPU path.
- **Community engagement** — % subscribers posting/reacting weekly (retention lever; a dead feed is worse than none).

## 3. Monetization
- **MRR** decomposed into new/expansion/contraction/churned (movement > level).
- **ARPU**, **subscriber (logo) churn** + **revenue churn** (monthly; >7% bad, <3% excellent). Track **failed-payment (involuntary) churn separately** — recoverable via dunning.
- **LTV** = ARPU ÷ monthly churn; watch **LTV:CAC ≥3:1** once acquisition spend exists.
- **Revenue per program**. Calibration: at $15/mo, ~670 paid subs = $10K MRR. Offer an **annual tier** (annual retains ~36% @1yr vs ~6.7% monthly).

## 4. Technical / operational (small guardrail panel)
- **Sync-queue health** (offline-first, highest priority) — pending mutations, **sync failure rate**, median queue age, clients with stuck/growing queue. Won't show in any generic tool; most app-specific risk.
- **API error rate & latency** (4xx/5xx, p50/p95 on PostgREST/Edge Functions).
- **Crash rate / uptime**; **AI photo-estimator health** (success rate, latency, cost/estimate).
- **Supabase usage vs plan limits** (DB size, connection-pool saturation, egress, MAU vs caps). Surface Supabase's built-in Reports rather than rebuilding.

## 5. Minimal v1 dashboard — build THESE 8 tiles first (all from existing tables)
| # | Metric | Chart | Data |
|---|--------|-------|------|
| 1 | **Weekly Active Loggers (North Star)** + stickiness | Line + % callout | distinct user_id from `workouts` by week; WAU/MAU |
| 2 | New-user activation funnel | Funnel (4 bars) | signup → onboarding → plan loaded → first workout |
| 3 | Signup cohort retention | Cohort heatmap | weekly cohort × % logged in week N, from `workouts` + signup date |
| 4 | MRR + movement | Stacked bar | `subscriptions` state changes → monthly deltas |
| 5 | Free → paid conversion | Funnel/line | `subscriptions` free → paid + median time-to-upgrade |
| 6 | Program leaderboard: subscribers × adherence | Scatter/grouped bar | `subscriptions` per `plan_template` × logged÷prescribed |
| 7 | Subscriber churn (voluntary vs failed-payment) | Line, 2 series | cancellations ÷ active start-of-month, tagged by reason |
| 8 | Sync-queue + error health | Line/sparkline + red band | sync failure rate + API 5xx over time |

Optional 9–10 if cheap: **streak distribution** (bar), **dormancy count** (single stat: 0 logs in 14d).
Design: 4 big-number stat cards on top (WAU, MRR, active paid subs, activation %), then funnel + cohort heatmap + program leaderboard. **Spend real chart effort on the cohort heatmap + the program leaderboard** — those change decisions.

## 6. Cheap-now vs needs-a-tool
- **Compute TODAY from Supabase (SQL views only):** WAU/MAU/stickiness, frequency, streaks, dormancy, retention curves, cohort heatmaps, adherence (from `workouts`/`set_logs`/`pr_history`); nutrition rate + AI-vs-manual (from `meal_entries`); MRR/ARPU/churn/free→paid/subs-per-program/LTV (from `subscriptions`); revenue-per-program + plan-load→first-workout (from `plan_templates` + `subscriptions` + `workouts`). → **write as SQL views/matviews, render in the hub. $0.**
- **Needs event tracking (a UI action that never hits a table):** onboarding step drop-off, paywall/screen views, browse-vs-load, feed views, coaching-CTA clicks, session replay. → **add PostHog free tier (1M events/mo) at v1.5**, once optimizing onboarding/paywall. Don't start with Amplitude/Mixpanel.
- **Technical health:** Supabase built-in Reports + Metrics API (free) before any paid APM.

**Sequence:** v1 (now) = SQL views → 8-tile hub, $0. v1.5 = PostHog for funnels/replay. v2 = LTV:CAC, dunning, cohort revenue when spend/scale justify.

**Bottom line:** North Star = Weekly Active Loggers; aha = first full workout. Build the 8-tile SQL dashboard from tables you already own. Two visuals deserve real craft: the **cohort retention heatmap** and the **program subscribers × adherence leaderboard**.
