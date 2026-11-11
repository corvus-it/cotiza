import 'server-only';
import { cache } from 'react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { roles, users } from '@/lib/db/schemas';

export type CurrentUser = {
	id: number;
	name: string;
	email: string;
	roleCode: string;
	companyId: number | null;
};

/** Máximo de una columna `integer` (int4) de PostgreSQL. */
const PG_INT_MAX = 2_147_483_647;

function parseDevUserId(raw: string | undefined): number | null {
	const value = raw?.trim();
	if (!value || !/^\d+$/.test(value)) return null;
	const id = Number(value);
	if (!Number.isSafeInteger(id) || id <= 0 || id > PG_INT_MAX) return null;
	return id;
}

/**
 * Usuario actual de la petición.
 *
 * TODO(auth): provisional hasta tener login. Hoy se resuelve desde la variable
 * de entorno `DEV_USER_ID`; al integrar autenticación real solo cambia esta
 * función (p. ej. leer y verificar la sesión desde cookies).
 *
 * Devuelve `null` si `DEV_USER_ID` falta o no es un entero positivo, o si el
 * usuario no existe, está inactivo (`active = false`) o no tiene rol válido.
 * `companyId` puede ser `null` ("sin empresa").
 *
 * Se deduplica por petición con `React.cache`. No envolver en `'use cache'`:
 * el resultado depende del usuario.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
	const id = parseDevUserId(process.env.DEV_USER_ID);
	if (id === null) return null;

	const [row] = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			roleCode: roles.code,
			companyId: users.companyId,
		})
		.from(users)
		// Sin FKs en BD: un rol inexistente deja al usuario sin resolver.
		.innerJoin(roles, eq(roles.id, users.rolId))
		.where(and(eq(users.id, id), eq(users.active, true)))
		.limit(1);

	return row ?? null;
});
