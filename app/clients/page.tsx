import { Button } from "antd";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingFallback } from "@/app/components/loading-fallback";
import { Page, Panel } from "@/app/components/page-layout";
import { listClients } from "@/lib/clients/queries";
import { ClientsTable } from "./_components/clients-table";

export const metadata: Metadata = { title: "Clientes" };

export default function ClientsPage({ searchParams }: PageProps<"/clients">) {
	return (
		<Page
			title="Clientes"
			description="Personas y empresas a las que les presupuestas, con sus vehículos."
			actions={
				<Link href="/clients/new-client">
					<Button type="primary" icon={<PlusIcon size={16} />}>
						Nuevo cliente
					</Button>
				</Link>
			}
		>
			<Panel>
				<Suspense fallback={<LoadingFallback />}>
					<ClientsList searchParams={searchParams} />
				</Suspense>
			</Panel>
		</Page>
	);
}

async function ClientsList({ searchParams }: Pick<PageProps<"/clients">, "searchParams">) {
	const { q } = await searchParams;
	const query = typeof q === "string" ? q.trim() : "";
	const clients = await listClients(query);
	return <ClientsTable query={query} clients={clients} />;
}
