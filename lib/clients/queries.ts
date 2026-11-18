import "server-only";
import { and, asc, eq, exists, ilike, or } from "drizzle-orm";
import { authorize } from "@/lib/auth/authorize";
import { vehiclesByClient, type AssignedVehicle } from "@/lib/client-vehicles/assignments";
import { db } from "@/lib/db";
import { clients, clientVehicles, vehicles, type Client } from "@/lib/db/schemas";

export type ClientWithVehicles = Pick<Client, "id" | "rut" | "name" | "email" | "phone"> & {
	/** Vehículos activos del cliente. */
	vehicles: AssignedVehicle[];
};

export type ClientOption = { id: number; name: string; rut: string };

const clientFields = {
	id: clients.id,
	rut: clients.rut,
	name: clients.name,
	email: clients.email,
	phone: clients.phone,
};

/** Escapa los comodines de LIKE para buscar el texto literal. */
function likePattern(text: string): string {
	return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

async function withVehicles(rows: Omit<ClientWithVehicles, "vehicles">[]): Promise<ClientWithVehicles[]> {
	const byClient = await vehiclesByClient(rows.map((r) => r.id));
	return rows.map((row) => ({ ...row, vehicles: byClient.get(row.id) ?? [] }));
}

/*
 * Todas las consultas se limitan a la empresa de la sesión (`authorize`): el
 * `companyId` no se recibe como parámetro, así ningún llamador puede pedir
 * datos de otra empresa.
 */

/** Clientes activos de la empresa, por nombre. `q` filtra por RUT, nombre, correo o patente. */
export async function listClients(q?: string): Promise<ClientWithVehicles[]> {
	const { companyId } = await authorize();
	const term = q?.trim();
	const filters = [eq(clients.companyId, companyId), eq(clients.active, true)];

	if (term) {
		const pattern = likePattern(term);
		const plateMatches = db
			.select({ id: clientVehicles.id })
			.from(clientVehicles)
			.innerJoin(vehicles, eq(vehicles.id, clientVehicles.vehicleId))
			.where(
				and(
					eq(clientVehicles.clientId, clients.id),
					eq(vehicles.active, true),
					// La patente se guarda sin espacios, puntos ni guiones.
					ilike(vehicles.plate, likePattern(term.replace(/[\s.\-·]/g, ""))),
				),
			);
		filters.push(
			or(
				ilike(clients.name, pattern),
				ilike(clients.email, pattern),
				// El RUT se guarda sin puntos: también se busca sin ellos.
				ilike(clients.rut, likePattern(term.replace(/\./g, ""))),
				exists(plateMatches),
			)!,
		);
	}

	const rows = await db
		.select(clientFields)
		.from(clients)
		.where(and(...filters))
		.orderBy(asc(clients.name), asc(clients.id));
	return withVehicles(rows);
}

/** Cliente activo de la empresa por id (con sus vehículos activos), o `null`. */
export async function getActiveClient(id: number): Promise<ClientWithVehicles | null> {
	const { companyId } = await authorize();
	const rows = await db
		.select(clientFields)
		.from(clients)
		.where(and(eq(clients.id, id), eq(clients.companyId, companyId), eq(clients.active, true)))
		.limit(1);
	return (await withVehicles(rows))[0] ?? null;
}

/** Clientes activos de la empresa para los selectores. */
export async function listClientOptions(): Promise<ClientOption[]> {
	const { companyId } = await authorize();
	return db
		.select({ id: clients.id, name: clients.name, rut: clients.rut })
		.from(clients)
		.where(and(eq(clients.companyId, companyId), eq(clients.active, true)))
		.orderBy(asc(clients.name), asc(clients.id));
}
