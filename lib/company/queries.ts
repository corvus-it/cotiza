import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getBudgetAccess } from "@/lib/budgets/queries";
import { db } from "@/lib/db";
import { roles, users, type Company } from "@/lib/db/schemas";
import type { CurrentUser } from "@/lib/auth/current-user";
import { ADMIN_ROLE } from "./validation";

export type CompanyAccess =
	| { ok: true; user: CurrentUser; company: Company; isAdmin: boolean }
	| { ok: false; reason: "no-user" | "no-company" };

/** Usuario actual, su empresa y si puede administrarla. */
export async function getCompanyAccess(): Promise<CompanyAccess> {
	const access = await getBudgetAccess();
	if (!access.ok) return access;
	return { ...access, isAdmin: access.user.roleCode === ADMIN_ROLE };
}

export type Worker = {
	id: number;
	name: string;
	email: string;
	roleId: number;
	roleCode: string;
	roleName: string;
	active: boolean;
	createdAt: Date;
};

/** Usuarios de la empresa (activos primero, luego por nombre). */
export async function listWorkers(companyId: number): Promise<Worker[]> {
	return db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			roleId: users.rolId,
			roleCode: roles.code,
			roleName: roles.description,
			active: users.active,
			createdAt: users.createdAt,
		})
		.from(users)
		.innerJoin(roles, eq(roles.id, users.rolId))
		.where(eq(users.companyId, companyId))
		.orderBy(desc(users.active), asc(users.name), asc(users.id));
}

export type RoleOption = { id: number; code: string; name: string };

/** Roles activos para asignar a los trabajadores. */
export async function listRoleOptions(): Promise<RoleOption[]> {
	return db
		.select({ id: roles.id, code: roles.code, name: roles.description })
		.from(roles)
		.where(eq(roles.active, true))
		.orderBy(asc(roles.description));
}
