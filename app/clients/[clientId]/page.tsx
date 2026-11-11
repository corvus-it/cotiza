import { formatearRut } from "cotizacion-cl";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateClient } from "@/lib/actions/clients";
import { getActiveClient, parseClientId } from "@/lib/clients/queries";
import { ClientForm } from "../_components/client-form";
import { LoadingFallback } from "../_components/loading-fallback";

export default function EditClientPage({ params }: PageProps<"/clients/[clientId]">) {
	return (
		<main style={{ padding: 24 }}>
			<Suspense fallback={<LoadingFallback />}>
				<EditClient params={params} />
			</Suspense>
		</main>
	);
}

async function EditClient({ params }: Pick<PageProps<"/clients/[clientId]">, "params">) {
	const { clientId } = await params;
	const id = parseClientId(clientId);
	const client = id === null ? null : await getActiveClient(id);
	if (!client) notFound();

	return (
		<ClientForm
			title={`Editar cliente: ${client.name}`}
			submitLabel="Guardar cambios"
			action={updateClient.bind(null, client.id)}
			initialValues={{
				rut: formatearRut(client.rut),
				name: client.name,
				email: client.email ?? "",
				phone: client.phone ?? "",
			}}
		/>
	);
}
