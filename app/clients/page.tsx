import { Suspense } from "react";
import { listClients } from "@/lib/clients/queries";
import { ClientsTable } from "./_components/clients-table";
import { LoadingFallback } from "./_components/loading-fallback";

export default function ClientsPage({ searchParams }: PageProps<"/clients">) {
	return (
		<main style={{ padding: 24 }}>
			<h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Clientes</h1>
			<Suspense fallback={<LoadingFallback />}>
				<ClientsList searchParams={searchParams} />
			</Suspense>
		</main>
	);
}

async function ClientsList({ searchParams }: Pick<PageProps<"/clients">, "searchParams">) {
	const { q } = await searchParams;
	const query = typeof q === "string" ? q.trim() : "";
	const rows = await listClients(query);

	return (
		<ClientsTable
			query={query}
			clients={rows.map(({ id, rut, name, email, phone }) => ({ id, rut, name, email, phone }))}
		/>
	);
}
