import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingFallback } from "@/app/components/loading-fallback";
import { Page } from "@/app/components/page-layout";
import { createVehicle } from "@/lib/actions/vehicles";
import { listClientOptions } from "@/lib/clients/queries";
import { VehicleForm } from "../_components/vehicle-form";

export const metadata: Metadata = { title: "Nuevo vehículo" };

export default function NewVehiclePage() {
	return (
		<Page
			width="narrow"
			title="Nuevo vehículo"
			description="La patente, la marca y el modelo son obligatorios."
			back={{ href: "/vehicles", label: "Vehículos" }}
		>
			<Suspense fallback={<LoadingFallback />}>
				<NewVehicleForm />
			</Suspense>
		</Page>
	);
}

async function NewVehicleForm() {
	const clients = await listClientOptions();
	return (
		<VehicleForm
			submitLabel="Crear vehículo"
			clients={clients}
			action={createVehicle}
		/>
	);
}
