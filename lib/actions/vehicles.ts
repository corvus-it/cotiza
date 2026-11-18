"use server";

import { and, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/auth/authorize";
import { allActiveClients, runBatch, setVehicleClients } from "@/lib/client-vehicles/assignments";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { parseId } from "@/lib/db/parse-id";
import { vehicles } from "@/lib/db/schemas";
import {
	parseVehicleInput,
	type VehicleActionState,
	type InlineVehicleState,
	type VehicleData,
} from "@/lib/vehicles/validation";

/*
 * Dueños: `client_vehicles` es N:N. El vehículo y sus asignaciones se guardan en
 * un único `db.batch` (transacción en neon-http). Ver `lib/client-vehicles/assignments.ts`.
 */

const PLATE_TAKEN: Extract<VehicleActionState, { ok: false }> = {
	ok: false,
	fieldErrors: { plate: "Ya existe un vehículo con esta patente." },
};

const CLIENTS_NOT_FOUND: Extract<VehicleActionState, { ok: false }> = {
	ok: false,
	fieldErrors: { clientIds: "Algún cliente seleccionado no existe o fue eliminado." },
};

/** Vehículo de la empresa con esa patente (activo o no), excluyendo `excludeId`. */
async function findByPlate(companyId: number, plate: string, excludeId?: number) {
	const samePlate = and(eq(vehicles.companyId, companyId), eq(vehicles.plate, plate));
	const [row] = await db
		.select({ id: vehicles.id, active: vehicles.active })
		.from(vehicles)
		.where(excludeId ? and(samePlate, ne(vehicles.id, excludeId)) : samePlate)
		.limit(1);
	return row ?? null;
}

/**
 * Inserta un vehículo con sus dueños. Si la patente pertenece a un vehículo
 * eliminado (lógicamente), lo reactiva con los datos nuevos, ya que `plate`
 * es UNIQUE en la BD. Devuelve el vehículo guardado o el estado de error.
 */
async function insertVehicle(input: unknown): Promise<InlineVehicleState> {
	const { companyId } = await authorize();
	const parsed = parseVehicleInput(input);
	if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
	const data: VehicleData = parsed.data;
	const { clientIds } = parsed;

	try {
		if (!(await allActiveClients(clientIds, companyId))) return CLIENTS_NOT_FOUND;

		const existing = await findByPlate(companyId, data.plate);
		if (existing?.active) return PLATE_TAKEN;

		await runBatch(
			existing
				? [
						db
							.update(vehicles)
							.set({ ...data, active: true, updatedAt: new Date() })
							.where(eq(vehicles.id, existing.id)),
						...setVehicleClients({ id: existing.id, plate: data.plate }, clientIds, companyId),
					]
				: [
						db.insert(vehicles).values({ ...data, companyId }),
						...setVehicleClients({ id: null, plate: data.plate }, clientIds, companyId),
					],
		);

		const saved = await findByPlate(companyId, data.plate);
		if (!saved) throw new Error(`Vehículo ${data.plate} no encontrado tras guardarlo`);
		return {
			ok: true,
			vehicle: { id: saved.id, plate: data.plate, brand: data.brand, model: data.model, ownerIds: clientIds },
		};
	} catch (error) {
		if (isUniqueViolation(error)) return PLATE_TAKEN;
		console.error("createVehicle", error);
		return { ok: false, message: "No se pudo crear el vehículo. Inténtalo de nuevo." };
	}
}

/** Crea un vehículo y vuelve al listado. */
export async function createVehicle(input: unknown): Promise<VehicleActionState> {
	const result = await insertVehicle(input);
	if (!result.ok) return result;
	redirect("/vehicles");
}

/**
 * Crea un vehículo sin salir de la página (p. ej. desde el formulario de
 * presupuesto) y devuelve la opción para seleccionarlo.
 */
export async function createVehicleInline(input: unknown): Promise<InlineVehicleState> {
	return insertVehicle(input);
}

/** Modifica un vehículo activo y sus dueños. */
export async function updateVehicle(
	rawId: unknown,
	input: unknown,
): Promise<VehicleActionState> {
	const { companyId } = await authorize();
	const id = parseId(rawId);
	if (id === null) return { ok: false, message: "Vehículo inválido." };

	const parsed = parseVehicleInput(input);
	if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
	const { data, clientIds } = parsed;

	try {
		if (!(await allActiveClients(clientIds, companyId))) return CLIENTS_NOT_FOUND;

		const other = await findByPlate(companyId, data.plate, id);
		if (other) {
			return other.active
				? PLATE_TAKEN
				: {
						ok: false,
						fieldErrors: { plate: "Esta patente pertenece a un vehículo eliminado." },
					};
		}

		const [current] = await db
			.select({ id: vehicles.id })
			.from(vehicles)
			.where(and(eq(vehicles.id, id), eq(vehicles.companyId, companyId), eq(vehicles.active, true)))
			.limit(1);
		if (!current) return { ok: false, message: "El vehículo no existe o fue eliminado." };

		await runBatch([
			db
				.update(vehicles)
				.set({ ...data, updatedAt: new Date() })
				.where(and(eq(vehicles.id, id), eq(vehicles.companyId, companyId), eq(vehicles.active, true))),
			...setVehicleClients({ id, plate: data.plate }, clientIds, companyId),
		]);
	} catch (error) {
		if (isUniqueViolation(error)) return PLATE_TAKEN;
		console.error("updateVehicle", error);
		return { ok: false, message: "No se pudo guardar el vehículo. Inténtalo de nuevo." };
	}

	redirect("/vehicles");
}

/**
 * Borrado lógico: marca el vehículo como inactivo. Sus asignaciones se
 * conservan (histórico) y dejan de mostrarse.
 */
export async function deleteVehicle(rawId: unknown): Promise<VehicleActionState> {
	const { companyId } = await authorize();
	const id = parseId(rawId);
	if (id === null) return { ok: false, message: "Vehículo inválido." };

	try {
		const updated = await db
			.update(vehicles)
			.set({ active: false, updatedAt: new Date() })
			.where(and(eq(vehicles.id, id), eq(vehicles.companyId, companyId), eq(vehicles.active, true)))
			.returning({ id: vehicles.id });

		if (updated.length === 0) {
			return { ok: false, message: "El vehículo no existe o ya fue eliminado." };
		}
	} catch (error) {
		console.error("deleteVehicle", error);
		return { ok: false, message: "No se pudo eliminar el vehículo. Inténtalo de nuevo." };
	}

	refresh();
	return { ok: true };
}
