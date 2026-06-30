import { CoachPageHeader } from "@/components/coach/CoachPageHeader";
import { OnboardClientForm } from "@/components/coach/OnboardClientForm";

export default function OnboardClientPage() {
  return (
    <div className="space-y-2">
      <CoachPageHeader
        title="Onboard client"
        subtitle="Invite to your roster"
        backHref="/coach"
        backLabel="Back to roster"
      />
      <OnboardClientForm />
    </div>
  );
}
