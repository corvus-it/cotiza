import type { NextRequest } from "next/server";
import { XLSX_FORMATS, xlsxFilename, xlsxResponse, type XlsxColumn } from "@/lib/export/xlsx";
import { listVehicles, type VehicleWithClients } from "@/lib/vehicles/queries";

const columns: XlsxColumn<VehicleWithClients>[] = [
	{ header: "Patente", value: (v) => v.plate },
	{ header: "Marca", value: (v) => v.brand, width: 16 },
	{ header: "Modelo", value: (v) => v.model, width: 20 },
	{ header: "Año", value: (v) => v.year, width: 8 },
	{ header: "Motor", value: (v) => v.motor },
	{ header: "Combustible", value: (v) => v.fuelType, width: 14 },
	{ header: "Kilometraje", value: (v) => v.mileage, numFmt: XLSX_FORMATS.integer, width: 14 },
	{ header: "Dueños", value: (v) => v.clients.map((c) => c.name).join(", "), width: 36 },
];

/** GET /vehicles/export?q= → Excel con los vehículos activos de la empresa (mismo filtro que el listado). */
export async function GET(request: NextRequest) {
	// `listVehicles` autoriza y limita a la empresa de la sesión.
	const vehicles = await listVehicles(request.nextUrl.searchParams.get("q") ?? undefined);
	return xlsxResponse({
		filename: xlsxFilename("vehiculos"),
		sheetName: "Vehículos",
		columns,
		rows: vehicles,
	});
}
