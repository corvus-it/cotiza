import { connection } from "next/server";
import { Suspense } from "react";
import { createClient } from "@/lib/actions/clients";
import { ClientForm } from "../_components/client-form";
import { LoadingFallback } from "../_components/loading-fallback";

export default function NewClientPage() {
	return (
		<main style={{ padding: 24 }}>
			<Suspense fallback={<LoadingFallback />}>
				<NewClientForm />
			</Suspense>
		</main>
	);
}

/** antd Form lee `Date.now()` al renderizar: se renderiza por petición, no en el prerender. */
async function NewClientForm() {
	await connection();
	return <ClientForm title="Nuevo cliente" submitLabel="Crear cliente" action={createClient} />;
}
