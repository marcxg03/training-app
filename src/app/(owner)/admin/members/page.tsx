import { NotBuiltYet } from "@/components/admin/NotBuiltYet";

export default function AdminMembersPage() {
  return (
    <NotBuiltYet
      title="Members"
      because="There are no members. The app has one account — yours — and no subscription, follower or membership table exists yet. Community is still a navigable placeholder (D21)."
      unblockedBy="A subscriptions/membership migration, plus the publish-and-claim path that lets a second person load one of your programs. Both come after the solo-testing period."
    />
  );
}
