import "server-only";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, type Client } from "@/lib/db/schemas";

/** Escapa los comodines de LIKE para buscar el texto literal. */
function likePattern(text: string): string {
	return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Clientes activos, ordenados por nombre. `q` filtra por RUT, nombre o correo. */
export async function listClients(q?: string): Promise<Client[]> {
	const term = q?.trim();
	const filters = [eq(clients.active, true)];

	if (term) {
		const pattern = likePattern(term);
		// El RUT se guarda sin puntos: también se busca sin ellos.
		const rutPattern = likePattern(term.replace(/\./g, ""));
		filters.push(
			or(
				ilike(clients.name, pattern),
				ilike(clients.email, pattern),
				ilike(clients.rut, rutPattern),
			)!,
		);
	}

	return db
		.select()
		.from(clients)
		.where(and(...filters))
		.orderBy(asc(clients.name), asc(clients.id));
}

/** Cliente activo por id, o `null` si no existe o fue eliminado. */
export async function getActiveClient(id: number): Promise<Client | null> {
	const [row] = await db
		.select()
		.from(clients)
		.where(and(eq(clients.id, id), eq(clients.active, true)))
		.limit(1);
	return row ?? null;
}

/** Máximo de una columna `integer` (int4) de PostgreSQL. */
const PG_INT_MAX = 2_147_483_647;

export function parseClientId(raw: unknown): number | null {
	const value = typeof raw === "string" ? raw : String(raw ?? "");
	if (!/^\d+$/.test(value)) return null;
	const id = Number(value);
	return Number.isSafeInteger(id) && id > 0 && id <= PG_INT_MAX ? id : null;
}
