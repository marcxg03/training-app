import { notFound } from "next/navigation";

import { CoachNotesThread } from "@/components/coach/CoachNotesThread";
import { CoachPageHeader } from "@/components/coach/CoachPageHeader";
import { getClient, getClientNotes } from "@/lib/coach/queries";

type CoachNotesPageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function CoachNotesPage({ params }: CoachNotesPageProps) {
  const { clientId } = await params;
  const client = await getClient(clientId);

  if (!client) {
    notFound();
  }

  const notes = await getClientNotes(clientId);
  const firstName = client.name.split(" ")[0];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <CoachPageHeader
        title={`Notes · ${firstName}`}
        subtitle={`Visible to ${firstName}`}
        backHref={`/coach/clients/${clientId}`}
        backLabel="Back to client"
      />
      <div className="mt-3 flex flex-1 flex-col">
        <CoachNotesThread clientId={clientId} initialNotes={notes} />
      </div>
    </div>
  );
}
