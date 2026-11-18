/** `true` si el error (o alguna de sus causas) es una violación UNIQUE de PostgreSQL. */
export function isUniqueViolation(error: unknown): boolean {
	for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
		if ((e as { code?: unknown }).code === "23505") return true;
	}
	return false;
}
