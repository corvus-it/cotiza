import "server-only";
import { and, eq, inArray, notInArray, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "@/lib/db";
import { clients, clientVehicles, vehicles } from "@/lib/db/schemas";

/*
 * Asignaciones N:N cliente ↔ vehículo (`client_vehicles`, UNIQUE (client_id, vehicle_id)).
 *
 * Las funciones devuelven sentencias para `db.batch` (transacción en neon-http),
 * de modo que el cambio del cliente/vehículo y sus asignaciones sea atómico.
 * Al reemplazar solo se tocan filas de contrapartes ACTIVAS: las asignaciones a
 * registros eliminados (lógicamente) se conservan como histórico.
 *
 * Todo se limita a una empresa (`companyId`): un cliente solo puede tener
 * vehículos de su misma empresa, y RUT/patente son únicos POR empresa.
 */

export type Statement = BatchItem<"pg">;

/** Ejecuta las sentencias en una sola transacción (o nada, si no hay). */
export async function runBatch(statements: Statement[]): Promise<void> {
	if (statements.length === 0) return;
	const [first, ...rest] = statements;
	await db.batch([first, ...rest]);
}

/** `true` si todos los ids corresponden a clientes activos de la empresa. */
export async function allActiveClients(ids: number[], companyId: number): Promise<boolean> {
	if (ids.length === 0) return true;
	const rows = await db
		.select({ id: clients.id })
		.from(clients)
		.where(and(inArray(clients.id, ids), eq(clients.companyId, companyId), eq(clients.active, true)));
	return rows.length === ids.length;
}

/** `true` si todos los ids corresponden a vehículos activos de la empresa. */
export async function allActiveVehicles(ids: number[], companyId: number): Promise<boolean> {
	if (ids.length === 0) return true;
	const rows = await db
		.select({ id: vehicles.id })
		.from(vehicles)
		.where(and(inArray(vehicles.id, ids), eq(vehicles.companyId, companyId), eq(vehicles.active, true)));
	return rows.length === ids.length;
}

const activeClientIds = (companyId: number) =>
	db
		.select({ id: clients.id })
		.from(clients)
		.where(and(eq(clients.companyId, companyId), eq(clients.active, true)));
const activeVehicleIds = (companyId: number) =>
	db
		.select({ id: vehicles.id })
		.from(vehicles)
		.where(and(eq(vehicles.companyId, companyId), eq(vehicles.active, true)));

/**
 * Deja al vehículo asignado exactamente a `clientIds` (entre los clientes activos).
 * `vehicleId` es `null` si el vehículo se inserta en el mismo batch: la
 * inserción lo localiza por empresa + patente (UNIQUE), ya actualizada en ese punto.
 */
export function setVehicleClients(
	vehicle: { id: number | null; plate: string },
	clientIds: number[],
	companyId: number,
): Statement[] {
	const statements: Statement[] = [];

	if (vehicle.id !== null) {
		const filters: SQL[] = [
			eq(clientVehicles.vehicleId, vehicle.id),
			inArray(clientVehicles.clientId, activeClientIds(companyId)),
		];
		if (clientIds.length > 0) filters.push(notInArray(clientVehicles.clientId, clientIds));
		statements.push(db.delete(clientVehicles).where(and(...filters)));
	}

	if (clientIds.length > 0) {
		statements.push(
			db
				.insert(clientVehicles)
				.select(
					db
						.select({ clientId: clients.id, vehicleId: vehicles.id })
						.from(clients)
						.innerJoin(
							vehicles,
							and(eq(vehicles.companyId, companyId), eq(vehicles.plate, vehicle.plate)),
						)
						.where(
							and(
								inArray(clients.id, clientIds),
								eq(clients.companyId, companyId),
								eq(clients.active, true),
							),
						),
				)
				.onConflictDoNothing(),
		);
	}

	return statements;
}

/**
 * Deja al cliente asignado exactamente a `vehicleIds` (entre los vehículos activos).
 * `clientId` es `null` si el cliente se inserta en el mismo batch: la
 * inserción lo localiza por empresa + RUT (UNIQUE), ya actualizado en ese punto.
 */
export function setClientVehicles(
	client: { id: number | null; rut: string },
	vehicleIds: number[],
	companyId: number,
): Statement[] {
	const statements: Statement[] = [];

	if (client.id !== null) {
		const filters: SQL[] = [
			eq(clientVehicles.clientId, client.id),
			inArray(clientVehicles.vehicleId, activeVehicleIds(companyId)),
		];
		if (vehicleIds.length > 0) filters.push(notInArray(clientVehicles.vehicleId, vehicleIds));
		statements.push(db.delete(clientVehicles).where(and(...filters)));
	}

	if (vehicleIds.length > 0) {
		statements.push(
			db
				.insert(clientVehicles)
				.select(
					db
						.select({ clientId: clients.id, vehicleId: vehicles.id })
						.from(vehicles)
						.innerJoin(clients, and(eq(clients.companyId, companyId), eq(clients.rut, client.rut)))
						.where(
							and(
								inArray(vehicles.id, vehicleIds),
								eq(vehicles.companyId, companyId),
								eq(vehicles.active, true),
							),
						),
				)
				.onConflictDoNothing(),
		);
	}

	return statements;
}

export type AssignedClient = { id: number; name: string };
export type AssignedVehicle = { id: number; plate: string };

/** Clientes activos asignados a cada vehículo (ordenados por nombre). */
export async function clientsByVehicle(
	vehicleIds: number[],
): Promise<Map<number, AssignedClient[]>> {
	const map = new Map<number, AssignedClient[]>();
	if (vehicleIds.length === 0) return map;
	const rows = await db
		.select({ vehicleId: clientVehicles.vehicleId, id: clients.id, name: clients.name })
		.from(clientVehicles)
		.innerJoin(clients, and(eq(clients.id, clientVehicles.clientId), eq(clients.active, true)))
		.where(inArray(clientVehicles.vehicleId, vehicleIds))
		.orderBy(clients.name, clients.id);
	for (const { vehicleId, ...client } of rows) {
		map.set(vehicleId, [...(map.get(vehicleId) ?? []), client]);
	}
	return map;
}

/** Vehículos activos asignados a cada cliente (ordenados por patente). */
export async function vehiclesByClient(
	clientIds: number[],
): Promise<Map<number, AssignedVehicle[]>> {
	const map = new Map<number, AssignedVehicle[]>();
	if (clientIds.length === 0) return map;
	const rows = await db
		.select({ clientId: clientVehicles.clientId, id: vehicles.id, plate: vehicles.plate })
		.from(clientVehicles)
		.innerJoin(vehicles, and(eq(vehicles.id, clientVehicles.vehicleId), eq(vehicles.active, true)))
		.where(inArray(clientVehicles.clientId, clientIds))
		.orderBy(vehicles.plate);
	for (const { clientId, ...vehicle } of rows) {
		map.set(clientId, [...(map.get(clientId) ?? []), vehicle]);
	}
	return map;
}
