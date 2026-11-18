import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db";
import { roles, sessions, users } from "@/lib/db/schemas";
import { currentSessionId } from "./session";

export type CurrentUser = {
	id: number;
	name: string;
	email: string;
	roleCode: string;
	companyId: number | null;
};

/**
 * Usuario de la sesión actual (cookie `cg_session`), o `null` si no hay
 * sesión, venció, o el usuario está inactivo o sin rol válido.
 *
 * Se deduplica por petición con `React.cache`. No envolver en `'use cache'`:
 * el resultado depende de la cookie.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
	const sessionId = await currentSessionId();
	if (!sessionId) return null;

	const [row] = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			roleCode: roles.code,
			companyId: users.companyId,
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.innerJoin(roles, eq(roles.id, users.rolId))
		.where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
		.limit(1);

	return row ?? null;
});
