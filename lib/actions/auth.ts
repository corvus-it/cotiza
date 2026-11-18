"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schemas";

export type LoginState = { ok: false; message: string } | { ok: true };

const INVALID: LoginState = { ok: false, message: "Correo o contraseña incorrectos." };

/*
 * Hash de referencia para comparar cuando el correo no existe: así la respuesta
 * tarda lo mismo y no revela qué correos están registrados.
 */
const DUMMY_HASH =
	"scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

/** Solo rutas internas: evita redirigir a otro sitio con `?next=`. */
function safeNext(next: unknown): string {
	return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login")
		? next
		: "/";
}

export async function login(input: { email?: unknown; password?: unknown; next?: unknown }): Promise<LoginState> {
	const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
	const password = typeof input.password === "string" ? input.password : "";
	if (!email || !password || email.length > 150 || password.length > 200) return INVALID;

	const [user] = await db
		.select({ id: users.id, passwordHash: users.passwordHash })
		.from(users)
		.where(and(eq(users.email, email), eq(users.active, true), isNotNull(users.companyId)))
		.limit(1);

	const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
	if (!user || !valid) return INVALID;

	try {
		await createSession(user.id);
	} catch (error) {
		console.error("login", error);
		return { ok: false, message: "No se pudo iniciar sesión. Inténtalo de nuevo." };
	}

	redirect(safeNext(input.next));
}

export async function logout(): Promise<void> {
	await deleteSession();
	redirect("/login");
}
