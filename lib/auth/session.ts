import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schemas";

/*
 * Sesiones de login guardadas en la BD (tabla `sessions`).
 * La cookie lleva un token aleatorio de 256 bits; la BD solo guarda su SHA-256,
 * así que un volcado de la tabla no sirve para entrar. Cerrar sesión o
 * desactivar al usuario corta el acceso de inmediato.
 */

export const SESSION_COOKIE = "cg_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Hash del token de la cookie actual, o `null` si no hay cookie. */
export async function currentSessionId(): Promise<string | null> {
	const token = (await cookies()).get(SESSION_COOKIE)?.value;
	return token ? hashToken(token) : null;
}

/** Crea la sesión y deja la cookie (solo en Server Actions / Route Handlers). */
export async function createSession(userId: number): Promise<void> {
	const token = randomBytes(32).toString("base64url");
	const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

	await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
	// De paso, limpia las sesiones vencidas de este usuario.
	await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));

	(await cookies()).set(SESSION_COOKIE, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		expires: expiresAt,
	});
}

/** Borra la sesión actual de la BD y la cookie. */
export async function deleteSession(): Promise<void> {
	const id = await currentSessionId();
	if (id) await db.delete(sessions).where(eq(sessions.id, id));
	(await cookies()).delete(SESSION_COOKIE);
}

/** Cierra todas las sesiones de un usuario (p. ej. al cambiarle la contraseña). */
export async function deleteUserSessions(userId: number): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}
