import { notFound } from "next/navigation";

import { ClientTargetsForm } from "@/components/coach/ClientTargetsForm";
import { getClient, getClientTargets } from "@/lib/coach/mock";

type ClientTargetsPageProps = {
  params: Promise<{ clientId: string }>;
};

export default async function ClientTargetsPage({
  params,
}: ClientTargetsPageProps) {
  const { clientId } = await params;
  const client = getClient(clientId);

  if (!client) {
    notFound();
  }

  const targets = getClientTargets(clientId);

  return (
    <ClientTargetsForm
      clientId={clientId}
      clientName={client.name}
      targets={targets}
    />
  );
}
