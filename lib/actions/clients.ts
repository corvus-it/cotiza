"use server";

import { and, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schemas";
import { parseClientId } from "@/lib/clients/queries";
import {
	parseClientInput,
	type ClientActionState,
	type ClientData,
} from "@/lib/clients/validation";

/**
 * TODO(auth): las Server Actions son invocables por POST directo. Cuando exista
 * login, verificar aquí la sesión/permisos (p. ej. `getCurrentUser()`).
 */
async function authorize(): Promise<void> {}

const RUT_TAKEN: ClientActionState = {
	ok: false,
	fieldErrors: { rut: "Ya existe un cliente con este RUT." },
};

function isUniqueViolation(error: unknown): boolean {
	for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
		if ((e as { code?: unknown }).code === "23505") return true;
	}
	return false;
}

async function findByRut(rut: string, excludeId?: number) {
	const [row] = await db
		.select({ id: clients.id, active: clients.active })
		.from(clients)
		.where(excludeId ? and(eq(clients.rut, rut), ne(clients.id, excludeId)) : eq(clients.rut, rut))
		.limit(1);
	return row ?? null;
}

/**
 * Crea un cliente. Si el RUT pertenece a un cliente eliminado (lógicamente),
 * lo reactiva con los datos nuevos, ya que `rut` es UNIQUE en la BD.
 */
export async function createClient(input: unknown): Promise<ClientActionState> {
	await authorize();
	const parsed = parseClientInput(input);
	if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
	const data: ClientData = parsed.data;

	try {
		const existing = await findByRut(data.rut);
		if (existing?.active) return RUT_TAKEN;

		if (existing) {
			await db
				.update(clients)
				.set({ ...data, active: true, updatedAt: new Date() })
				.where(eq(clients.id, existing.id));
		} else {
			await db.insert(clients).values(data);
		}
	} catch (error) {
		if (isUniqueViolation(error)) return RUT_TAKEN;
		console.error("createClient", error);
		return { ok: false, message: "No se pudo crear el cliente. Inténtalo de nuevo." };
	}

	redirect("/clients");
}

/** Modifica un cliente activo. */
export async function updateClient(
	rawId: unknown,
	input: unknown,
): Promise<ClientActionState> {
	await authorize();
	const id = parseClientId(rawId);
	if (id === null) return { ok: false, message: "Cliente inválido." };

	const parsed = parseClientInput(input);
	if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };

	try {
		const other = await findByRut(parsed.data.rut, id);
		if (other) {
			return other.active
				? RUT_TAKEN
				: {
						ok: false,
						fieldErrors: { rut: "Este RUT pertenece a un cliente eliminado." },
					};
		}

		const updated = await db
			.update(clients)
			.set({ ...parsed.data, updatedAt: new Date() })
			.where(and(eq(clients.id, id), eq(clients.active, true)))
			.returning({ id: clients.id });

		if (updated.length === 0) {
			return { ok: false, message: "El cliente no existe o fue eliminado." };
		}
	} catch (error) {
		if (isUniqueViolation(error)) return RUT_TAKEN;
		console.error("updateClient", error);
		return { ok: false, message: "No se pudo guardar el cliente. Inténtalo de nuevo." };
	}

	redirect("/clients");
}

/** Borrado lógico: marca el cliente como inactivo. */
export async function deleteClient(rawId: unknown): Promise<ClientActionState> {
	await authorize();
	const id = parseClientId(rawId);
	if (id === null) return { ok: false, message: "Cliente inválido." };

	try {
		const updated = await db
			.update(clients)
			.set({ active: false, updatedAt: new Date() })
			.where(and(eq(clients.id, id), eq(clients.active, true)))
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
