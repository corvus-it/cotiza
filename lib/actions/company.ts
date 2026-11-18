"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { authorize } from "@/lib/auth/authorize";
import { hashPassword } from "@/lib/auth/password";
import { deleteUserSessions } from "@/lib/auth/session";
import { getCompanyAccess, type CompanyAccess } from "@/lib/company/queries";
import {
	ADMIN_ROLE,
	parseCompanyInput,
	parseWorkerInput,
	type CompanyActionState,
	type WorkerActionState,
} from "@/lib/company/validation";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { parseId } from "@/lib/db/parse-id";
import { companies, roles, users } from "@/lib/db/schemas";

type Failure = { ok: false; message: string };

const NO_ACCESS: Record<"no-user" | "no-company", Failure> = {
	"no-user": { ok: false, message: "Tu sesión terminó. Vuelve a ingresar." },
	"no-company": { ok: false, message: "Tu usuario no tiene una empresa asignada." },
};
const NOT_ADMIN: Failure = { ok: false, message: "Solo un administrador puede modificar la empresa." };

/** Empresa del usuario actual, solo si es administrador. */
async function adminAccess(): Promise<Extract<CompanyAccess, { ok: true }> | Failure> {
	await authorize();
	const access = await getCompanyAccess();
	if (!access.ok) return NO_ACCESS[access.reason];
	if (!access.isAdmin) return NOT_ADMIN;
	return access;
}

// ---------------------------------------------------------------------------
// Datos de la empresa
// ---------------------------------------------------------------------------

export async function updateCompany(input: unknown): Promise<CompanyActionState> {
	const access = await adminAccess();
	if (!access.ok) return access;

	const parsed = parseCompanyInput(input);
	if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };

	try {
		await db.update(companies).set(parsed.data).where(eq(companies.id, access.company.id));
	} catch (error) {
		if (isUniqueViolation(error))
			return { ok: false, fieldErrors: { rut: "Ya existe otra empresa con este RUT." } };
		console.error("updateCompany", error);
		return { ok: false, message: "No se pudieron guardar los datos. Inténtalo de nuevo." };
	}

	refresh();
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Trabajadores
// ---------------------------------------------------------------------------

const EMAIL_TAKEN: WorkerActionState = {
	ok: false,
	fieldErrors: { email: "Ya existe un usuario con este correo." },
};

/** Código del rol si existe y está activo. */
async function activeRoleCode(roleId: number): Promise<string | null> {
	const [role] = await db
		.select({ code: roles.code })
		.from(roles)
		.where(and(eq(roles.id, roleId), eq(roles.active, true)))
		.limit(1);
	return role?.code ?? null;
}

/** Usuario de la empresa (activo o no), o `null`. */
async function findWorker(id: number, companyId: number) {
	const [row] = await db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.id, id), eq(users.companyId, companyId)))
		.limit(1);
	return row ?? null;
}

export async function createWorker(input: unknown): Promise<WorkerActionState> {
	const access = await adminAccess();
	if (!access.ok) return access;

	const parsed = parseWorkerInput(input, { passwordRequired: true });
	if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
	const { data, password } = parsed;

	try {
		if (!(await activeRoleCode(data.roleId)))
			return { ok: false, fieldErrors: { roleId: "El rol no existe o está inactivo." } };

		await db.insert(users).values({
			name: data.name,
			email: data.email,
			rolId: data.roleId,
			passwordHash: await hashPassword(password!),
			companyId: access.company.id,
		});
	} catch (error) {
		if (isUniqueViolation(error)) return EMAIL_TAKEN;
		console.error("createWorker", error);
		return { ok: false, message: "No se pudo crear el trabajador. Inténtalo de nuevo." };
	}

	refresh();
	return { ok: true };
}

export async function updateWorker(rawId: unknown, input: unknown): Promise<WorkerActionState> {
	const access = await adminAccess();
	if (!access.ok) return access;

	const id = parseId(rawId);
	if (id === null) return { ok: false, message: "Trabajador inválido." };

	const parsed = parseWorkerInput(input, { passwordRequired: false });
	if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
	const { data, password } = parsed;

	try {
		const roleCode = await activeRoleCode(data.roleId);
		if (!roleCode) return { ok: false, fieldErrors: { roleId: "El rol no existe o está inactivo." } };
		// Evita que la empresa se quede sin administrador por un error propio.
		if (id === access.user.id && roleCode !== ADMIN_ROLE)
			return { ok: false, fieldErrors: { roleId: "No puedes quitarte el rol de administrador." } };

		if (!(await findWorker(id, access.company.id)))
			return { ok: false, message: "El trabajador no existe en tu empresa." };

		await db
			.update(users)
			.set({
				name: data.name,
				email: data.email,
				rolId: data.roleId,
				...(password ? { passwordHash: await hashPassword(password) } : {}),
				updatedAt: new Date(),
			})
			.where(and(eq(users.id, id), eq(users.companyId, access.company.id)));

		// Contraseña nueva: se cierran las sesiones abiertas de ese trabajador
		// (las propias se mantienen para no sacarte de la app).
		if (password && id !== access.user.id) await deleteUserSessions(id);
	} catch (error) {
		if (isUniqueViolation(error)) return EMAIL_TAKEN;
		console.error("updateWorker", error);
		return { ok: false, message: "No se pudo guardar el trabajador. Inténtalo de nuevo." };
	}

	refresh();
	return { ok: true };
}

/**
 * Activa o desactiva el acceso de un trabajador (borrado lógico: sus
 * presupuestos se conservan). Un usuario no puede desactivarse a sí mismo.
 */
export async function setWorkerActive(rawId: unknown, active: unknown): Promise<WorkerActionState> {
	const access = await adminAccess();
	if (!access.ok) return access;

	const id = parseId(rawId);
	if (id === null || typeof active !== "boolean") return { ok: false, message: "Solicitud inválida." };
	if (id === access.user.id && !active) return { ok: false, message: "No puedes desactivar tu propio usuario." };

	try {
		const updated = await db
			.update(users)
			.set({ active, updatedAt: new Date() })
			.where(and(eq(users.id, id), eq(users.companyId, access.company.id)))
			.returning({ id: users.id });
		if (updated.length === 0) return { ok: false, message: "El trabajador no existe en tu empresa." };
		if (!active) await deleteUserSessions(id);
	} catch (error) {
		console.error("setWorkerActive", error);
		return { ok: false, message: "No se pudo actualizar el trabajador. Inténtalo de nuevo." };
	}

	refresh();
	return { ok: true };
}
