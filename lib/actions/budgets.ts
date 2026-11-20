"use server";

import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { CotizacionError, crearCotizacion, type Cotizacion } from "cotizacion-cl";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { runBatch, type Statement } from "@/lib/client-vehicles/assignments";
import { totalsFrom, toAdjustments, toItems, type BudgetTotals } from "@/lib/budgets/calculation";
import { getBudgetAccess, ofCompany } from "@/lib/budgets/queries";
import {
	libraryFieldToFormKey,
	parseBudgetInput,
	type BudgetActionState,
	type BudgetData,
	type BudgetFieldErrors,
} from "@/lib/budgets/validation";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { budgetDetails, budgets, clients, serviceTypes, vehicles, type Company } from "@/lib/db/schemas";

const NO_ACCESS: Record<"no-user" | "no-company", BudgetActionState> = {
	"no-user": { ok: false, message: "Tu sesión terminó. Vuelve a ingresar." },
	"no-company": { ok: false, message: "Tu usuario no tiene una empresa asignada." },
};

/** Prefijo y largo del código visible del presupuesto: PRE-000123. */
const CODE_PREFIX = "PRE-";
const CODE_DIGITS = 6;
const MAX_NUMBER_RETRIES = 3;

function codeFor(budgetNumber: number): string {
	return `${CODE_PREFIX}${String(budgetNumber).padStart(CODE_DIGITS, "0")}`;
}

/**
 * Comprueba en la BD que cliente y vehículo sean de la empresa y estén activos,
 * y que los tipos de servicio existan y estén activos.
 */
async function checkReferences(
	data: BudgetData,
	companyId: number,
	allowedServiceTypeIds: number[] = [],
): Promise<{ client: typeof clients.$inferSelect } | { errors: BudgetFieldErrors }> {
	const serviceTypeIds = [...new Set(data.lines.map((l) => l.serviceTypeId))];
	const [[client], [vehicle], types] = await Promise.all([
		db
			.select()
			.from(clients)
			.where(and(eq(clients.id, data.clientId), eq(clients.companyId, companyId), eq(clients.active, true)))
			.limit(1),
		db
			.select({ id: vehicles.id })
			.from(vehicles)
			.where(and(eq(vehicles.id, data.vehicleId), eq(vehicles.companyId, companyId), eq(vehicles.active, true)))
			.limit(1),
		db
			.select({ id: serviceTypes.id, active: serviceTypes.active })
			.from(serviceTypes)
			.where(inArray(serviceTypes.id, serviceTypeIds)),
	]);

	const errors: BudgetFieldErrors = {};
	if (!client) errors.clientId = "El cliente no existe o fue eliminado.";
	if (!vehicle) errors.vehicleId = "El vehículo no existe o fue eliminado.";
	// Un tipo inactivo solo se acepta si el presupuesto ya lo usaba.
	const valid = new Set(
		types.filter((t) => t.active || allowedServiceTypeIds.includes(t.id)).map((t) => t.id),
	);
	data.lines.forEach((line, i) => {
		if (!valid.has(line.serviceTypeId)) errors[`lines.${i}.serviceTypeId`] = "Tipo de servicio no disponible.";
	});

	return Object.keys(errors).length > 0 ? { errors } : { client: client! };
}

/**
 * Emite la cotización con cotizacion-cl (valida RUT de emisor y receptor,
 * fechas y montos; calcula IVA y totales) y devuelve los montos a guardar.
 */
function quote(
	data: BudgetData,
	company: Company,
	client: typeof clients.$inferSelect,
	code: string,
): { ok: true; totals: BudgetTotals } | { ok: false; state: BudgetActionState } {
	let cotizacion: Cotizacion;
	try {
		cotizacion = crearCotizacion({
			numero: code,
			fechaEmision: data.date,
			validezDias: data.validityDays,
			moneda: "CLP",
			emisor: {
				rut: company.rut,
				razonSocial: company.name,
				giro: company.businessActivity ?? undefined,
				direccion: company.address ?? undefined,
				comuna: company.commune ?? undefined,
				ciudad: company.city ?? undefined,
				email: company.email ?? undefined,
				telefono: company.phone ?? undefined,
				sitioWeb: company.website ?? undefined,
				logoUrl: company.logo ?? undefined,
			},
			receptor: {
				rut: client.rut,
				razonSocial: client.name,
				email: client.email ?? undefined,
				telefono: client.phone ?? undefined,
			},
			items: toItems(data.lines),
			ajustesGlobales: toAdjustments(data.discount),
			observaciones: data.additionalObservations ?? undefined,
		});
	} catch (error) {
		if (!(error instanceof CotizacionError)) throw error;
		const fieldErrors: BudgetFieldErrors = {};
		const general: string[] = [];
		for (const { campo, mensaje } of error.errores) {
			const key = libraryFieldToFormKey(campo);
			if (key) fieldErrors[key] ??= mensaje;
			else if (campo.startsWith("emisor"))
				general.push(`Datos de la empresa (${campo}): ${mensaje}. Revísalos en «Mi empresa».`);
			else general.push(`${campo}: ${mensaje}`);
		}
		return {
			ok: false,
			state: { ok: false, fieldErrors, message: general.join(" ") || undefined },
		};
	}

	return {
		ok: true,
		totals: totalsFrom(
			cotizacion.lineas,
			data.lines.map((l) => l.category),
			cotizacion.totales,
		),
	};
}

function budgetValues(data: BudgetData, totals: BudgetTotals) {
	return {
		clientId: data.clientId,
		vehicleId: data.vehicleId,
		date: data.date,
		validityDays: data.validityDays,
		diagnosis: data.diagnosis,
		additionalObservations: data.additionalObservations,
		estimatedDeliveryDate: data.estimatedDeliveryDate,
		sparePartsAmount: totals.sparePartsAmount,
		labourAmount: totals.labourAmount,
		otherChargesAmount: totals.otherChargesAmount,
		discount: totals.discount,
		netoAmount: totals.netoAmount,
		ivaAmount: totals.ivaAmount,
		totalAmount: totals.totalAmount,
	};
}

/** Inserta las líneas de un presupuesto identificado por empresa + código (UNIQUE). */
function insertLinesByCode(companyId: number, code: string, data: BudgetData): Statement[] {
	return data.lines.map((line) =>
		db.insert(budgetDetails).select(
			db
				.select({
					budgetId: budgets.id,
					serviceTypeId: sql<number>`${line.serviceTypeId}::int4`.as("service_type_id"),
					category: sql<typeof line.category>`${line.category}::varchar`.as("category"),
					description: sql<string>`${line.description}::varchar`.as("description"),
					quantity: sql<number>`${line.quantity}::numeric`.as("quantity"),
					unitAmount: sql<number>`${line.unitAmount}::numeric`.as("unit_amount"),
				})
				.from(budgets)
				.where(and(eq(budgets.companyId, companyId), eq(budgets.code, code))),
		),
	);
}

/** Siguiente número de la empresa: cada empresa parte en PRE-000001. */
async function nextBudgetNumber(companyId: number): Promise<number> {
	const [row] = await db
		.select({ n: sql<number>`coalesce(max(${budgets.budgetNumber}), 0) + 1`.mapWith(Number) })
		.from(budgets)
		.where(eq(budgets.companyId, companyId));
	return row.n;
}

/** Crea un presupuesto de la empresa del usuario actual. */
export async function createBudget(input: unknown): Promise<BudgetActionState> {
	const access = await getBudgetAccess();
	if (!access.ok) return NO_ACCESS[access.reason];

	const parsed = parseBudgetInput(input);
	if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
	const { data } = parsed;

	let code = "";
	try {
		const refs = await checkReferences(data, access.company.id);
		if ("errors" in refs) return { ok: false, fieldErrors: refs.errors };

		// `budget_number` y `code` son UNIQUE por empresa: si otro presupuesto toma el mismo
		// número a la vez, se reintenta con el siguiente.
		for (let attempt = 1; ; attempt++) {
			const budgetNumber = await nextBudgetNumber(access.company.id);
			code = codeFor(budgetNumber);
			const quoted = quote(data, access.company, refs.client, code);
			if (!quoted.ok) return quoted.state;

			try {
				await runBatch([
					db.insert(budgets).values({
						...budgetValues(data, quoted.totals),
						companyId: access.company.id,
						code,
						budgetNumber,
						userId: access.user.id,
					}),
					...insertLinesByCode(access.company.id, code, data),
				]);
				break;
			} catch (error) {
				if (!isUniqueViolation(error) || attempt >= MAX_NUMBER_RETRIES) throw error;
			}
		}
	} catch (error) {
		console.error("createBudget", error);
		return { ok: false, message: "No se pudo crear el presupuesto. Inténtalo de nuevo." };
	}

	redirect(`/budgets/${encodeURIComponent(code)}`);
}

/** Modifica un presupuesto no anulado ni aceptado de la empresa; reemplaza sus líneas. */
export async function updateBudget(rawCode: unknown, input: unknown): Promise<BudgetActionState> {
	const access = await getBudgetAccess();
	if (!access.ok) return NO_ACCESS[access.reason];
	if (typeof rawCode !== "string" || !rawCode) return { ok: false, message: "Presupuesto inválido." };

	const parsed = parseBudgetInput(input);
	if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
	const { data } = parsed;

	try {
		const [current] = await db
			.select({ id: budgets.id, active: budgets.active, acceptedAt: budgets.acceptedAt })
			.from(budgets)
			.where(and(eq(budgets.code, rawCode), ofCompany(access.company.id)))
			.limit(1);
		if (!current) return { ok: false, message: "El presupuesto no existe." };
		if (!current.active) return { ok: false, message: "El presupuesto está anulado y no se puede modificar." };
		if (current.acceptedAt)
			return { ok: false, message: "El presupuesto está aceptado. Revierte la aceptación para modificarlo." };

		const used = await db
			.select({ id: budgetDetails.serviceTypeId })
			.from(budgetDetails)
			.where(eq(budgetDetails.budgetId, current.id));
		const refs = await checkReferences(
			data,
			access.company.id,
			used.map((u) => u.id),
		);
		if ("errors" in refs) return { ok: false, fieldErrors: refs.errors };

		const quoted = quote(data, access.company, refs.client, rawCode);
		if (!quoted.ok) return quoted.state;

		await runBatch([
			db
				.update(budgets)
				.set(budgetValues(data, quoted.totals))
				.where(and(eq(budgets.id, current.id), eq(budgets.active, true), isNull(budgets.acceptedAt))),
			db.delete(budgetDetails).where(eq(budgetDetails.budgetId, current.id)),
			db.insert(budgetDetails).values(
				data.lines.map((line) => ({ ...line, budgetId: current.id })),
			),
		]);
	} catch (error) {
		console.error("updateBudget", error);
		return { ok: false, message: "No se pudo guardar el presupuesto. Inténtalo de nuevo." };
	}

	redirect(`/budgets/${encodeURIComponent(rawCode)}`);
}

/** Borrado lógico: anula el presupuesto (`active = false`), también si está aceptado. */
export async function annulBudget(rawCode: unknown): Promise<BudgetActionState> {
	const access = await getBudgetAccess();
	if (!access.ok) return NO_ACCESS[access.reason];
	if (typeof rawCode !== "string" || !rawCode) return { ok: false, message: "Presupuesto inválido." };

	try {
		const updated = await db
			.update(budgets)
			.set({ active: false })
			.where(and(eq(budgets.code, rawCode), eq(budgets.active, true), ofCompany(access.company.id)))
			.returning({ id: budgets.id });
		if (updated.length === 0) return { ok: false, message: "El presupuesto no existe o ya está anulado." };
	} catch (error) {
		console.error("annulBudget", error);
		return { ok: false, message: "No se pudo anular el presupuesto. Inténtalo de nuevo." };
	}

	refresh();
	return { ok: true };
}

/**
 * Marca el presupuesto como aceptado por el cliente. Solo un presupuesto activo
 * (vigente o vencido: el cliente puede aceptar fuera de plazo) y no aceptado.
 */
export async function acceptBudget(rawCode: unknown): Promise<BudgetActionState> {
	const access = await getBudgetAccess();
	if (!access.ok) return NO_ACCESS[access.reason];
	if (typeof rawCode !== "string" || !rawCode) return { ok: false, message: "Presupuesto inválido." };

	try {
		const updated = await db
			.update(budgets)
			.set({ acceptedAt: sql`now()`, acceptedBy: access.user.id })
			.where(
				and(
					eq(budgets.code, rawCode),
					eq(budgets.active, true),
					isNull(budgets.acceptedAt),
					ofCompany(access.company.id),
				),
			)
			.returning({ id: budgets.id });
		if (updated.length === 0)
			return { ok: false, message: "El presupuesto no existe, está anulado o ya fue aceptado." };
	} catch (error) {
		console.error("acceptBudget", error);
		return { ok: false, message: "No se pudo marcar como aceptado. Inténtalo de nuevo." };
	}

	refresh();
	return { ok: true };
}

/** Revierte la aceptación (p. ej. marcada por error): vuelve a vigente o vencido. */
export async function unacceptBudget(rawCode: unknown): Promise<BudgetActionState> {
	const access = await getBudgetAccess();
	if (!access.ok) return NO_ACCESS[access.reason];
	if (typeof rawCode !== "string" || !rawCode) return { ok: false, message: "Presupuesto inválido." };

	try {
		const updated = await db
			.update(budgets)
			.set({ acceptedAt: null, acceptedBy: null })
			.where(
				and(
					eq(budgets.code, rawCode),
					eq(budgets.active, true),
					isNotNull(budgets.acceptedAt),
					ofCompany(access.company.id),
				),
			)
			.returning({ id: budgets.id });
		if (updated.length === 0)
			return { ok: false, message: "El presupuesto no existe, está anulado o no está aceptado." };
	} catch (error) {
		console.error("unacceptBudget", error);
		return { ok: false, message: "No se pudo revertir la aceptación. Inténtalo de nuevo." };
	}

	refresh();
	return { ok: true };
}
