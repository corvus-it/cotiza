import { eq } from "drizzle-orm";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ADMIN_ROLE } from "@/lib/company/validation";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schemas";
import { AppShell, type ShellAccount } from "./app-shell";

/** Quita los valores de ejemplo del seed (`<<...>>`). */
const real = (value: string | null | undefined) => (value && !/<<.*>>/.test(value) ? value : null);

/**
 * Carga el usuario y la empresa para la barra lateral. No redirige: sin sesión
 * (p. ej. en `/login`) se muestra la página sin la barra.
 */
export async function Shell({ children }: { children: ReactNode }) {
	await connection();
	const user = await getCurrentUser();
	let account: ShellAccount | null = null;

	if (user?.companyId != null) {
		const [company] = await db
			.select({ name: companies.name })
			.from(companies)
			.where(eq(companies.id, user.companyId))
			.limit(1);
		account = {
			userName: real(user.name) ?? real(user.email) ?? "Usuario",
			role: user.roleCode === ADMIN_ROLE ? "Administrador" : "Trabajador",
			companyName: real(company?.name),
		};
	}

	return <AppShell account={account}>{children}</AppShell>;
}
