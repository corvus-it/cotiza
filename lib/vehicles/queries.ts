import "server-only";
import { and, asc, eq, exists, ilike, or } from "drizzle-orm";
import { authorize } from "@/lib/auth/authorize";
import { clientsByVehicle, type AssignedClient } from "@/lib/client-vehicles/assignments";
import { db } from "@/lib/db";
import { clients, clientVehicles, vehicles, type Vehicle } from "@/lib/db/schemas";

export type VehicleWithClients = Pick<
	Vehicle,
	"id" | "plate" | "brand" | "model" | "year" | "motor" | "fuelType" | "mileage"
> & {
	/** Dueños activos del vehículo. */
	clients: AssignedClient[];
};

export type VehicleOption = { id: number; plate: string; brand: string; model: string };

const vehicleFields = {
	id: vehicles.id,
	plate: vehicles.plate,
	brand: vehicles.brand,
	model: vehicles.model,
	year: vehicles.year,
	motor: vehicles.motor,
	fuelType: vehicles.fuelType,
	mileage: vehicles.mileage,
};

/** Escapa los comodines de LIKE para buscar el texto literal. */
function likePattern(text: string): string {
	return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

async function withClients(rows: Omit<VehicleWithClients, "clients">[]): Promise<VehicleWithClients[]> {
	const byVehicle = await clientsByVehicle(rows.map((r) => r.id));
	return rows.map((row) => ({ ...row, clients: byVehicle.get(row.id) ?? [] }));
}

/*
 * Todas las consultas se limitan a la empresa de la sesión (`authorize`).
 */

/** Vehículos activos de la empresa, por patente. `q` filtra por patente, marca, modelo o dueño. */
export async function listVehicles(q?: string): Promise<VehicleWithClients[]> {
	const { companyId } = await authorize();
	const term = q?.trim();
	const filters = [eq(vehicles.companyId, companyId), eq(vehicles.active, true)];

	if (term) {
		const pattern = likePattern(term);
		const ownerMatches = db
			.select({ id: clientVehicles.id })
			.from(clientVehicles)
			.innerJoin(clients, eq(clients.id, clientVehicles.clientId))
			.where(
				and(
					eq(clientVehicles.vehicleId, vehicles.id),
					eq(clients.active, true),
					ilike(clients.name, pattern),
				),
			);
		filters.push(
			or(
				ilike(vehicles.plate, likePattern(term.replace(/[\s.\-·]/g, ""))),
				ilike(vehicles.brand, pattern),
				ilike(vehicles.model, pattern),
				exists(ownerMatches),
			)!,
		);
	}

	const rows = await db
		.select(vehicleFields)
		.from(vehicles)
		.where(and(...filters))
		.orderBy(asc(vehicles.plate));
	return withClients(rows);
}

/** Vehículo activo de la empresa por id (con sus dueños activos), o `null`. */
export async function getActiveVehicle(id: number): Promise<VehicleWithClients | null> {
	const { companyId } = await authorize();
	const rows = await db
		.select(vehicleFields)
		.from(vehicles)
		.where(and(eq(vehicles.id, id), eq(vehicles.companyId, companyId), eq(vehicles.active, true)))
		.limit(1);
	return (await withClients(rows))[0] ?? null;
}

/** Vehículos activos de la empresa para el selector del módulo de clientes. */
export async function listVehicleOptions(): Promise<VehicleOption[]> {
	const { companyId } = await authorize();
	return db
		.select({ id: vehicles.id, plate: vehicles.plate, brand: vehicles.brand, model: vehicles.model })
		.from(vehicles)
		.where(and(eq(vehicles.companyId, companyId), eq(vehicles.active, true)))
		.orderBy(asc(vehicles.plate));
}
