import { formatearRut } from "cotizacion-cl";
import type { NextRequest } from "next/server";
import { listClients, type ClientWithVehicles } from "@/lib/clients/queries";
import { xlsxFilename, xlsxResponse, type XlsxColumn } from "@/lib/export/xlsx";

const columns: XlsxColumn<ClientWithVehicles>[] = [
	{ header: "RUT", value: (c) => formatearRut(c.rut), width: 14 },
	{ header: "Nombre", value: (c) => c.name, width: 32 },
	{ header: "Correo", value: (c) => c.email, width: 30 },
	{ header: "Teléfono", value: (c) => c.phone, width: 16 },
	{ header: "Vehículos", value: (c) => c.vehicles.map((v) => v.plate).join(", "), width: 30 },
];

/** GET /clients/export?q= → Excel con los clientes activos de la empresa (mismo filtro que el listado). */
export async function GET(request: NextRequest) {
	// `listClients` autoriza y limita a la empresa de la sesión.
	const clients = await listClients(request.nextUrl.searchParams.get("q") ?? undefined);
	return xlsxResponse({
		filename: xlsxFilename("clientes"),
		sheetName: "Clientes",
		columns,
		rows: clients,
	});
}
