import { notFound } from "next/navigation";

import { AssignTrainingForm } from "@/components/coach/AssignTrainingForm";
import { getClient, getClientAssignment } from "@/lib/coach/mock";

type AssignTrainingPageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function AssignTrainingPage({
  params,
}: AssignTrainingPageProps) {
  const { clientId } = await params;
  const client = getClient(clientId);

  if (!client) {
    notFound();
  }

  const assignment = getClientAssignment(clientId);

  return (
    <AssignTrainingForm
      clientId={clientId}
      clientName={client.name}
      assignment={assignment}
    />
  );
}
