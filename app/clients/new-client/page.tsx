import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingFallback } from "@/app/components/loading-fallback";
import { Page } from "@/app/components/page-layout";
import { createClient } from "@/lib/actions/clients";
import { listVehicleOptions } from "@/lib/vehicles/queries";
import { ClientForm } from "../_components/client-form";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default function NewClientPage() {
	return (
		<Page
			width="narrow"
			title="Nuevo cliente"
			description="El RUT y el nombre son obligatorios. Puedes asignarle vehículos ahora o más tarde."
			back={{ href: "/clients", label: "Clientes" }}
		>
			<Suspense fallback={<LoadingFallback />}>
				<NewClientForm />
			</Suspense>
		</Page>
	);
}

async function NewClientForm() {
	const vehicles = await listVehicleOptions();
	return (
		<ClientForm
			submitLabel="Crear cliente"
			vehicles={vehicles}
			action={createClient}
		/>
	);
}
