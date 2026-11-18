import { normalizarFecha } from "cotizacion-cl";
import { parseId } from "@/lib/db/parse-id";
import { isBudgetCategory, type BudgetCategory } from "./calculation";

export const MAX_LINES = 50;
export const MAX_VALIDITY_DAYS = 365;
/** numeric(10,2) */
export const MAX_QUANTITY = 99_999_999.99;
/** numeric(14,2), en CLP enteros. */
export const MAX_AMOUNT = 999_999_999_999;

export type BudgetLineInput = {
	category: BudgetCategory;
	serviceTypeId: number;
	description: string;
	quantity: number;
	unitAmount: number;
};

/** Datos del formulario de presupuesto (lo que envía la UI). */
export type BudgetInput = {
	clientId: number;
	vehicleId: number;
	/** "YYYY-MM-DD" */
	date: string;
	validityDays: number;
	/** "YYYY-MM-DD" o vacío */
	estimatedDeliveryDate?: string | null;
	diagnosis?: string | null;
	additionalObservations?: string | null;
	discount?: number | null;
	lines: BudgetLineInput[];
};

export type BudgetData = {
	clientId: number;
	vehicleId: number;
	date: string;
	validityDays: number;
	estimatedDeliveryDate: string | null;
	diagnosis: string | null;
	additionalObservations: string | null;
	discount: number;
	lines: BudgetLineInput[];
};

/**
 * Errores por campo. La clave es la ruta del campo en el formulario separada
 * por puntos (p. ej. "lines.2.quantity"); "lines" es un error de la lista.
 */
export type BudgetFieldErrors = Record<string, string>;

export type BudgetActionState =
	| { ok: true }
	| { ok: false; message?: string; fieldErrors?: BudgetFieldErrors };

function text(value: unknown, max: number): string | null | undefined {
	if (value === undefined || value === null) return null;
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (trimmed.length > max) return undefined;
	return trimmed || null;
}

function num(value: unknown): number {
	if (value === undefined || value === null || value === "") return Number.NaN;
	return typeof value === "number" ? value : Number(value);
}

function hasMaxDecimals(value: number, decimals: number): boolean {
	return Math.abs(Math.round(value * 10 ** decimals) - value * 10 ** decimals) < 1e-6;
}

/** Valida y normaliza. Se usa en el servidor (la UI repite reglas básicas). */
export function parseBudgetInput(
	input: unknown,
): { ok: true; data: BudgetData } | { ok: false; fieldErrors: BudgetFieldErrors } {
	const raw = (input ?? {}) as Record<string, unknown>;
	const errors: BudgetFieldErrors = {};

	const clientId = parseId(raw.clientId);
	if (clientId === null) errors.clientId = "Selecciona un cliente.";

	const vehicleId = parseId(raw.vehicleId);
	if (vehicleId === null) errors.vehicleId = "Selecciona un vehículo.";

	const date = typeof raw.date === "string" ? normalizarFecha(raw.date) : null;
	if (!date) errors.date = "Fecha inválida.";

	const validityDays = num(raw.validityDays);
	if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > MAX_VALIDITY_DAYS)
		errors.validityDays = `Entre 1 y ${MAX_VALIDITY_DAYS} días.`;

	let estimatedDeliveryDate: string | null = null;
	if (raw.estimatedDeliveryDate) {
		estimatedDeliveryDate =
			typeof raw.estimatedDeliveryDate === "string" ? normalizarFecha(raw.estimatedDeliveryDate) : null;
		if (!estimatedDeliveryDate) errors.estimatedDeliveryDate = "Fecha inválida.";
		else if (date && estimatedDeliveryDate < date)
			errors.estimatedDeliveryDate = "No puede ser anterior a la fecha del presupuesto.";
	}

	const diagnosis = text(raw.diagnosis, 5000);
	if (diagnosis === undefined) errors.diagnosis = "Máximo 5.000 caracteres.";

	const additionalObservations = text(raw.additionalObservations, 5000);
	if (additionalObservations === undefined)
		errors.additionalObservations = "Máximo 5.000 caracteres.";

	const discount = raw.discount === undefined || raw.discount === null || raw.discount === "" ? 0 : num(raw.discount);
	if (!Number.isInteger(discount) || discount < 0 || discount > MAX_AMOUNT)
		errors.discount = "Descuento inválido (monto entero en CLP).";

	const lines: BudgetLineInput[] = [];
	if (!Array.isArray(raw.lines) || raw.lines.length === 0) {
		errors.lines = "Agrega al menos una línea.";
	} else if (raw.lines.length > MAX_LINES) {
		errors.lines = `Máximo ${MAX_LINES} líneas.`;
	} else {
		raw.lines.forEach((item: unknown, i) => {
			const line = (item ?? {}) as Record<string, unknown>;
			const key = (field: string) => `lines.${i}.${field}`;

			const category = line.category;
			if (!isBudgetCategory(category)) errors[key("category")] = "Categoría inválida.";

			const serviceTypeId = parseId(line.serviceTypeId);
			if (serviceTypeId === null) errors[key("serviceTypeId")] = "Selecciona el tipo.";

			const description = text(line.description, 255);
			if (!description) errors[key("description")] = description === undefined ? "Máximo 255 caracteres." : "Obligatoria.";

			const quantity = num(line.quantity);
			if (!(quantity > 0) || quantity > MAX_QUANTITY || !hasMaxDecimals(quantity, 2))
				errors[key("quantity")] = "Cantidad inválida.";

			const unitAmount = num(line.unitAmount);
			if (!Number.isInteger(unitAmount) || unitAmount < 0 || unitAmount > MAX_AMOUNT)
				errors[key("unitAmount")] = "Precio inválido.";

			lines.push({
				category: category as BudgetCategory,
				serviceTypeId: serviceTypeId ?? 0,
				description: description ?? "",
				quantity,
				unitAmount,
			});
		});
	}

	if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

	return {
		ok: true,
		data: {
			clientId: clientId!,
			vehicleId: vehicleId!,
			date: date!,
			validityDays,
			estimatedDeliveryDate,
			diagnosis: diagnosis ?? null,
			additionalObservations: additionalObservations ?? null,
			discount,
			lines,
		},
	};
}

const LIBRARY_FIELDS: Record<string, string> = {
	cantidad: "quantity",
	precioUnitario: "unitAmount",
	descripcion: "description",
};

/**
 * Traduce un error de cotizacion-cl ("items[2].cantidad") a la ruta del
 * formulario ("lines.2.quantity"). `null` si no corresponde a un campo.
 */
export function libraryFieldToFormKey(campo: string): string | null {
	const item = /^items\[(\d+)\]\.(\w+)$/.exec(campo);
	if (item && LIBRARY_FIELDS[item[2]]) return `lines.${item[1]}.${LIBRARY_FIELDS[item[2]]}`;
	if (campo.startsWith("ajustesGlobales")) return "discount";
	if (campo === "items") return "lines";
	return null;
}
