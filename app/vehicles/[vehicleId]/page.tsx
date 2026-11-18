import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingFallback } from "@/app/components/loading-fallback";
import { Page, PageHeader } from "@/app/components/page-layout";
import { updateVehicle } from "@/lib/actions/vehicles";
import { parseId } from "@/lib/db/parse-id";
import { listClientOptions } from "@/lib/clients/queries";
import { getActiveVehicle } from "@/lib/vehicles/queries";
import { VehicleForm } from "../_components/vehicle-form";

export const metadata: Metadata = { title: "Editar vehículo" };

export default function EditVehiclePage({ params }: PageProps<"/vehicles/[vehicleId]">) {
	return (
		<Page width="narrow">
			<Suspense fallback={<LoadingFallback />}>
				<EditVehicle params={params} />
			</Suspense>
		</Page>
	);
}

async function EditVehicle({ params }: Pick<PageProps<"/vehicles/[vehicleId]">, "params">) {
	const { vehicleId } = await params;
	const id = parseId(vehicleId);
	const [vehicle, clients] = await Promise.all([
		id === null ? null : getActiveVehicle(id),
		listClientOptions(),
	]);
	if (!vehicle) notFound();

	return (
		<>
			<PageHeader
				title={vehicle.plate}
				description={[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ")}
				back={{ href: "/vehicles", label: "Vehículos" }}
			/>
			<VehicleForm
				submitLabel="Guardar cambios"
				clients={clients}
				action={updateVehicle.bind(null, vehicle.id)}
				initialValues={{
					plate: vehicle.plate,
					brand: vehicle.brand,
					model: vehicle.model,
					year: vehicle.year,
					motor: vehicle.motor,
					fuelType: vehicle.fuelType,
					mileage: vehicle.mileage,
					clientIds: vehicle.clients.map((c) => c.id),
				}}
			/>
		</>
	);
}
