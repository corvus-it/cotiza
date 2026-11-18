/** Máximo de una columna `integer` (int4) de PostgreSQL. */
const PG_INT_MAX = 2_147_483_647;

/** Convierte un id recibido (URL, formulario) en un int4 positivo, o `null`. */
export function parseId(raw: unknown): number | null {
	const value = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
	if (!/^\d+$/.test(value)) return null;
	const id = Number(value);
	return Number.isSafeInteger(id) && id > 0 && id <= PG_INT_MAX ? id : null;
}

/** Máximo de asignaciones aceptadas en un formulario. */
export const MAX_ID_LIST = 100;

/**
 * Lista de ids sin duplicados. `undefined`/`null` → `[]`.
 * Devuelve `null` si no es un array, si algún id es inválido o si supera `MAX_ID_LIST`.
 */
export function parseIdList(raw: unknown): number[] | null {
	if (raw === undefined || raw === null) return [];
	if (!Array.isArray(raw) || raw.length > MAX_ID_LIST) return null;
	const ids = new Set<number>();
	for (const item of raw) {
		const id = parseId(item);
		if (id === null) return null;
		ids.add(id);
	}
	return [...ids];
}
