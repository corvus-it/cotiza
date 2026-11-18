"use client";

import { Alert, Button } from "antd";
import { useEffect } from "react";

export default function BudgetsError({ error, retry }: { error: unknown; retry: () => void }) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<main style={{ padding: 24 }}>
			<Alert
				type="error"
				showIcon
				title="No se pudieron cargar los presupuestos"
				description="Ocurrió un error al consultar la base de datos. Inténtalo de nuevo en unos segundos."
				action={
					<Button size="small" onClick={() => retry()}>
						Reintentar
					</Button>
				}
			/>
		</main>
	);
}
