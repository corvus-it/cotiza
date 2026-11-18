import { Button } from "antd";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingFallback } from "@/app/components/loading-fallback";
import { Page, Panel } from "@/app/components/page-layout";
import { listVehicles } from "@/lib/vehicles/queries";
import { VehiclesTable } from "./_components/vehicles-table";

export const metadata: Metadata = { title: "Vehículos" };

export default function VehiclesPage({ searchParams }: PageProps<"/vehicles">) {
	return (
		<Page
			title="Vehículos"
			description="Vehículos registrados y sus dueños."
			actions={
				<Link href="/vehicles/new-vehicle">
					<Button type="primary" icon={<PlusIcon size={16} />}>
						Nuevo vehículo
					</Button>
				</Link>
			}
		>
			<Panel>
				<Suspense fallback={<LoadingFallback />}>
					<VehiclesList searchParams={searchParams} />
				</Suspense>
			</Panel>
		</Page>
	);
}

async function VehiclesList({ searchParams }: Pick<PageProps<"/vehicles">, "searchParams">) {
	const { q } = await searchParams;
	const query = typeof q === "string" ? q.trim() : "";
	const vehicles = await listVehicles(query);
	return <VehiclesTable query={query} vehicles={vehicles} />;
}
