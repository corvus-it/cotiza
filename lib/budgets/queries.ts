import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { connection } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import type { CurrentUser } from "@/lib/auth/current-user";
import { clientsByVehicle } from "@/lib/client-vehicles/assignments";
import { db } from "@/lib/db";
import {
	budgetDetails,
	budgets,
	clients,
	companies,
	serviceTypes,
	users,
	vehicles,
	type Company,
} from "@/lib/db/schemas";
import type { BudgetCategory } from "./calculation";
import { isBudgetStatus, type BudgetStatus } from "./status";

/** "Hoy" en Chile: la BD está en GMT y `CURRENT_DATE` se adelanta de noche. */
export const TODAY_CL = sql`(now() AT TIME ZONE 'America/Santiago')::date`;

const expiresOn = sql<string>`to_char(${budgets.date} + ${budgets.validityDays}, 'YYYY-MM-DD')`;
const statusSql = sql<BudgetStatus>`CASE
	WHEN NOT ${budgets.active} THEN 'anulado'
	WHEN ${budgets.date} + ${budgets.validityDays} < ${TODAY_CL} THEN 'vencido'
	ELSE 'vigente'
END`;

// ---------------------------------------------------------------------------
// Acceso: los presupuestos son de la empresa del usuario actual.
// ---------------------------------------------------------------------------

export type BudgetAccess =
	| { ok: true; user: CurrentUser; company: Company }
	| { ok: false; reason: "no-user" | "no-company" };

/**
 * Usuario de la sesión y su empresa. Sin sesión redirige a `/login`
 * (`authorize`). El `companyId` nunca viene del cliente.
 */
export async function getBudgetAccess(): Promise<BudgetAccess> {
	// Depende de la petición (usuario): nunca debe quedar fijo en el prerender.
	await connection();
	const { user, companyId } = await authorize();
	const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
	if (!company) return { ok: false, reason: "no-company" };
	return { ok: true, user, company };
}

/** Condición: el presupuesto pertenece a la empresa. */
export function ofCompany(companyId: number): SQL {
	return eq(budgets.companyId, companyId);
}

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------

export type BudgetListItem = {
	code: string;
	budgetNumber: number;
	date: string;
	expiresOn: string;
	status: BudgetStatus;
	netoAmount: number;
	ivaAmount: number;
	totalAmount: number;
	clientName: string;
	plate: string;
	brand: string;
	model: string;
	userName: string;
};

export type BudgetListFilters = {
	status?: unknown;
	search?: unknown;
	page?: unknown;
	pageSize?: number;
};

export type BudgetList = {
	items: BudgetListItem[];
	total: number;
	page: number;
	pageSize: number;
	status: BudgetStatus | null;
	search: string;
};

function likePattern(text: string): string {
	return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function parsePage(raw: unknown): number {
	const n = typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : 1;
	return Number.isSafeInteger(n) && n >= 1 && n <= 100_000 ? n : 1;
}

/** Presupuestos de la empresa, con filtro por estado, búsqueda y paginación. */
export async function getCompanyBudgets(
	companyId: number,
	filters: BudgetListFilters = {},
): Promise<BudgetList> {
	const pageSize = filters.pageSize ?? 10;
	const page = parsePage(filters.page);
	const status = isBudgetStatus(filters.status) ? filters.status : null;
	const search = typeof filters.search === "string" ? filters.search.trim().slice(0, 100) : "";

	const where: SQL[] = [ofCompany(companyId)];
	if (status) where.push(sql`${statusSql} = ${status}`);
	if (search) {
		const pattern = likePattern(search);
		where.push(
			or(
				ilike(budgets.code, pattern),
				ilike(clients.name, pattern),
				ilike(vehicles.plate, likePattern(search.toUpperCase().replace(/[\s.\-·]/g, ""))),
			)!,
		);
	}

	const base = db
		.select({
			code: budgets.code,
			budgetNumber: budgets.budgetNumber,
			date: budgets.date,
			expiresOn,
			status: statusSql,
			netoAmount: budgets.netoAmount,
			ivaAmount: budgets.ivaAmount,
			totalAmount: budgets.totalAmount,
			clientName: clients.name,
			plate: vehicles.plate,
			brand: vehicles.brand,
			model: vehicles.model,
			userName: users.name,
			total: sql<number>`count(*) over ()`.mapWith(Number),
		})
		.from(budgets)
		.innerJoin(users, eq(users.id, budgets.userId))
		.innerJoin(clients, eq(clients.id, budgets.clientId))
		.innerJoin(vehicles, eq(vehicles.id, budgets.vehicleId))
		.where(and(...where))
		.orderBy(desc(budgets.date), desc(budgets.budgetNumber))
		.limit(pageSize)
		.offset((page - 1) * pageSize);

	const rows = await base;
	let total = rows[0]?.total ?? 0;
	if (rows.length === 0 && page > 1) {
		// Página fuera de rango: el total se obtiene aparte.
		const [row] = await db
			.select({ n: sql<number>`count(*)`.mapWith(Number) })
			.from(budgets)
			.innerJoin(clients, eq(clients.id, budgets.clientId))
			.innerJoin(vehicles, eq(vehicles.id, budgets.vehicleId))
			.where(and(...where));
		total = row?.n ?? 0;
	}

	return {
		items: rows.map((row) => {
			const item: Partial<typeof row> = { ...row };
			delete item.total; // columna auxiliar del conteo
			return item as BudgetListItem;
		}),
		total,
		page,
		pageSize,
		status,
		search,
	};
}

// ---------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------

export type BudgetDetailLine = {
	category: BudgetCategory;
	serviceTypeId: number;
	description: string;
	quantity: number;
	unitAmount: number;
};

export type BudgetFull = {
	code: string;
	budgetNumber: number;
	clientId: number;
	vehicleId: number;
	date: string;
	expiresOn: string;
	validityDays: number;
	status: BudgetStatus;
	diagnosis: string | null;
	additionalObservations: string | null;
	estimatedDeliveryDate: string | null;
	sparePartsAmount: number;
	labourAmount: number;
	otherChargesAmount: number;
	discount: number;
	netoAmount: number;
	ivaAmount: number;
	totalAmount: number;
	userName: string;
	clientName: string;
	clientRut: string;
	plate: string;
	brand: string;
	model: string;
	lines: BudgetDetailLine[];
};

/** Presupuesto de la empresa por código (con sus líneas), o `null`. */
export async function getCompanyBudget(companyId: number, code: string): Promise<BudgetFull | null> {
	const [row] = await db
		.select({
			id: budgets.id,
			code: budgets.code,
			budgetNumber: budgets.budgetNumber,
			clientId: budgets.clientId,
			vehicleId: budgets.vehicleId,
			date: budgets.date,
			expiresOn,
			validityDays: budgets.validityDays,
			status: statusSql,
			diagnosis: budgets.diagnosis,
			additionalObservations: budgets.additionalObservations,
			estimatedDeliveryDate: budgets.estimatedDeliveryDate,
			sparePartsAmount: budgets.sparePartsAmount,
			labourAmount: budgets.labourAmount,
			otherChargesAmount: budgets.otherChargesAmount,
			discount: budgets.discount,
			netoAmount: budgets.netoAmount,
			ivaAmount: budgets.ivaAmount,
			totalAmount: budgets.totalAmount,
			userName: users.name,
			clientName: clients.name,
			clientRut: clients.rut,
			plate: vehicles.plate,
			brand: vehicles.brand,
			model: vehicles.model,
		})
		.from(budgets)
		.innerJoin(users, eq(users.id, budgets.userId))
		.innerJoin(clients, eq(clients.id, budgets.clientId))
		.innerJoin(vehicles, eq(vehicles.id, budgets.vehicleId))
		.where(and(eq(budgets.code, code), ofCompany(companyId)))
		.limit(1);
	if (!row) return null;
	const { id, ...budget } = row;

	const lines = await db
		.select({
			category: budgetDetails.category,
			serviceTypeId: budgetDetails.serviceTypeId,
			description: budgetDetails.description,
			quantity: budgetDetails.quantity,
			unitAmount: budgetDetails.unitAmount,
		})
		.from(budgetDetails)
		.where(eq(budgetDetails.budgetId, id))
		.orderBy(asc(budgetDetails.id));

	return { ...budget, lines };
}

// ---------------------------------------------------------------------------
// Opciones del formulario
// ---------------------------------------------------------------------------

export type ServiceTypeOption = { id: number; name: string };
export type BudgetVehicleOption = {
	id: number;
	plate: string;
	brand: string;
	model: string;
	ownerIds: number[];
};

/** Tipos de servicio activos. `includeIds` agrega inactivos ya usados en el presupuesto. */
export async function listServiceTypes(includeIds: number[] = []): Promise<ServiceTypeOption[]> {
	const active = eq(serviceTypes.active, true);
	return db
		.select({ id: serviceTypes.id, name: serviceTypes.name })
		.from(serviceTypes)
		.where(includeIds.length > 0 ? or(active, inArray(serviceTypes.id, includeIds)) : active)
		.orderBy(asc(serviceTypes.name));
}

/** Vehículos activos de la empresa con sus dueños activos (para filtrar por cliente en la UI). */
export async function listBudgetVehicles(): Promise<BudgetVehicleOption[]> {
	const { companyId } = await authorize();
	const rows = await db
		.select({ id: vehicles.id, plate: vehicles.plate, brand: vehicles.brand, model: vehicles.model })
		.from(vehicles)
		.where(and(eq(vehicles.companyId, companyId), eq(vehicles.active, true)))
		.orderBy(asc(vehicles.plate));
	const owners = await clientsByVehicle(rows.map((r) => r.id));
	return rows.map((row) => ({ ...row, ownerIds: (owners.get(row.id) ?? []).map((c) => c.id) }));
}

/** Fecha de hoy en Chile ("YYYY-MM-DD"), según la BD. */
export async function todayCL(): Promise<string> {
	const result = await db.execute<{ today: string }>(
		sql`select to_char(${TODAY_CL}, 'YYYY-MM-DD') as today`,
	);
	return result.rows[0].today;
}
