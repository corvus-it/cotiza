"use server";

import { and, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/auth/authorize";
import { allActiveVehicles, runBatch, setClientVehicles } from "@/lib/client-vehicles/assignments";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { clients } from "@/lib/db/schemas";
import { parseId } from "@/lib/db/parse-id";
import {
	parseClientInput,
	type ClientActionState,
	type ClientData,
	type InlineClientState,
} from "@/lib/clients/validation";

const VEHICLES_NOT_FOUND: Extract<ClientActionState, { ok: false }> = {
	ok: false,
	fieldErrors: { vehicleIds: "Algún vehículo seleccionado no existe o fue eliminado." },
};

const RUT_TAKEN: Extract<ClientActionState, { ok: false }> = {
	ok: false,
	fieldErrors: { rut: "Ya existe un cliente con este RUT." },
};

/** Cliente de la empresa con ese RUT (activo o no), excluyendo `excludeId`. */
async function findByRut(companyId: number, rut: string, excludeId?: number) {
	const sameRut = and(eq(clients.companyId, companyId), eq(clients.rut, rut));
	const [row] = await db
		.select({ id: clients.id, active: clients.active })
		.from(clients)
		.where(excludeId ? and(sameRut, ne(clients.id, excludeId)) : sameRut)
		.limit(1);
	return row ?? null;
}

/**
 * Inserta un cliente de la empresa. Si el RUT pertenece a un cliente eliminado (lógicamente),
 * lo reactiva con los datos nuevos, ya que `rut` es UNIQUE en la BD.
 * El cliente y sus vehículos se guardan en un único `db.batch` (transacción).
 * Devuelve el cliente guardado o el estado de error.
 */
async function insertClient(input: unknown): Promise<InlineClientState> {
	const { companyId } = await authorize();
	const parsed = parseClientInput(input);
	if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
	const data: ClientData = parsed.data;
	const { vehicleIds } = parsed;

	try {
		if (!(await allActiveVehicles(vehicleIds, companyId))) return VEHICLES_NOT_FOUND;

		const existing = await findByRut(companyId, data.rut);
		if (existing?.active) return RUT_TAKEN;

		await runBatch(
			existing
				? [
						db
							.update(clients)
							.set({ ...data, active: true, updatedAt: new Date() })
							.where(eq(clients.id, existing.id)),
						...setClientVehicles({ id: existing.id, rut: data.rut }, vehicleIds, companyId),
					]
				: [
						db.insert(clients).values({ ...data, companyId }),
						...setClientVehicles({ id: null, rut: data.rut }, vehicleIds, companyId),
					],
		);

		const saved = await findByRut(companyId, data.rut);
		if (!saved) throw new Error(`Cliente ${data.rut} no encontrado tras guardarlo`);
		return { ok: true, client: { id: saved.id, name: data.name, rut: data.rut } };
	} catch (error) {
		if (isUniqueViolation(error)) return RUT_TAKEN;
		console.error("createClient", error);
		return { ok: false, message: "No se pudo crear el cliente. Inténtalo de nuevo." };
	}
}

/** Crea un cliente y vuelve al listado. */
export async function createClient(input: unknown): Promise<ClientActionState> {
	const result = await insertClient(input);
	if (!result.ok) return result;
	redirect("/clients");
}

/**
 * Crea un cliente sin salir de la página (p. ej. desde el formulario de
 * presupuesto) y devuelve la opción para seleccionarlo.
 */
export async function createClientInline(input: unknown): Promise<InlineClientState> {
	return insertClient(input);
}

/** Modifica un cliente activo y sus vehículos. */
export async function updateClient(
	rawId: unknown,
	input: unknown,
): Promise<ClientActionState> {
	const { companyId } = await authorize();
	const id = parseId(rawId);
	if (id === null) return { ok: false, message: "Cliente inválido." };

	const parsed = parseClientInput(input);
	if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
	const { data, vehicleIds } = parsed;

	try {
		if (!(await allActiveVehicles(vehicleIds, companyId))) return VEHICLES_NOT_FOUND;

		const other = await findByRut(companyId, data.rut, id);
		if (other) {
			return other.active
				? RUT_TAKEN
				: {
						ok: false,
						fieldErrors: { rut: "Este RUT pertenece a un cliente eliminado." },
					};
		}

		const [current] = await db
			.select({ id: clients.id })
			.from(clients)
			.where(and(eq(clients.id, id), eq(clients.companyId, companyId), eq(clients.active, true)))
			.limit(1);
		if (!current) return { ok: false, message: "El cliente no existe o fue eliminado." };

		await runBatch([
			db
				.update(clients)
				.set({ ...data, updatedAt: new Date() })
				.where(and(eq(clients.id, id), eq(clients.companyId, companyId), eq(clients.active, true))),
			...setClientVehicles({ id, rut: data.rut }, vehicleIds, companyId),
		]);
	} catch (error) {
		if (isUniqueViolation(error)) return RUT_TAKEN;
		console.error("updateClient", error);
		return { ok: false, message: "No se pudo guardar el cliente. Inténtalo de nuevo." };
	}

	redirect("/clients");
}

/**
 * Borrado lógico: marca el cliente como inactivo. Sus asignaciones se
 * conservan (histórico) y dejan de mostrarse.
 */
export async function deleteClient(rawId: unknown): Promise<ClientActionState> {
	const { companyId } = await authorize();
	const id = parseId(rawId);
	if (id === null) return { ok: false, message: "Cliente inválido." };

	try {
		const updated = await db
			.update(clients)
			.set({ active: false, updatedAt: new Date() })
			.where(and(eq(clients.id, id), eq(clients.companyId, companyId), eq(clients.active, true)))
			.returning({ id: clients.id });

		if (updated.length === 0) {
			return { ok: false, message: "El cliente no existe o ya fue eliminado." };
		}
	} catch (error) {
		console.error("deleteClient", error);
		return { ok: false, message: "No se pudo eliminar el cliente. Inténtalo de nuevo." };
	}

	refresh();
	return { ok: true };
}
