import { formatearRut } from "cotizacion-cl";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateClient } from "@/lib/actions/clients";
import { getActiveClient } from "@/lib/clients/queries";
import { parseId } from "@/lib/db/parse-id";
import { listVehicleOptions } from "@/lib/vehicles/queries";
import { ClientForm } from "../_components/client-form";
import { LoadingFallback } from "@/app/components/loading-fallback";
import { Page, PageHeader } from "@/app/components/page-layout";

export const metadata: Metadata = { title: "Editar cliente" };

export default function EditClientPage({ params }: PageProps<"/clients/[clientId]">) {
	return (
		<Page width="narrow">
			<Suspense fallback={<LoadingFallback />}>
				<EditClient params={params} />
			</Suspense>
		</Page>
	);
}

async function EditClient({ params }: Pick<PageProps<"/clients/[clientId]">, "params">) {
	const { clientId } = await params;
	const id = parseId(clientId);
	const [client, vehicles] = await Promise.all([
		id === null ? null : getActiveClient(id),
		listVehicleOptions(),
	]);
	if (!client) notFound();

	return (
		<>
			<PageHeader
				title={client.name}
				description={`RUT ${formatearRut(client.rut)}`}
				back={{ href: "/clients", label: "Clientes" }}
			/>
			<ClientForm
				submitLabel="Guardar cambios"
				vehicles={vehicles}
				action={updateClient.bind(null, client.id)}
				initialValues={{
					rut: formatearRut(client.rut),
					name: client.name,
					email: client.email ?? "",
					phone: client.phone ?? "",
					vehicleIds: client.vehicles.map((v) => v.id),
				}}
			/>
		</>
	);
}
