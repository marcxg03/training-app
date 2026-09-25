import { NotBuiltYet } from "@/components/admin/NotBuiltYet";

export default function AdminAnalyticsPage() {
  return (
    <NotBuiltYet
      title="Analytics"
      because="The 8-tile spec in spec/ADMIN_HUB_ANALYTICS.md reads its marketplace and money tiles (MRR, free-to-paid, churn, subscriber leaderboard) from a `subscriptions` table that does not exist in this schema. The remaining tiles are computable today, but with one user they would report a Weekly Active Loggers count of 1 and cohorts of one person."
      unblockedBy="T3-C, which builds only the tiles that are true at n=1 — training consistency, adherence against prescribed sets, streaks, dormancy and volume. The marketplace tiles wait for a subscriptions migration and actual subscribers."
    />
  );
}
