import {
	calcular,
	CotizacionError,
	type AjusteGlobal,
	type ErrorValidacion,
	type ItemInput,
} from "cotizacion-cl";

/** Categoría de una línea: define a qué monto del presupuesto suma. */
export const BUDGET_CATEGORIES = {
	repuesto: "Repuestos",
	mano_obra: "Mano de obra",
	otro: "Otros cargos",
} as const;

export type BudgetCategory = keyof typeof BUDGET_CATEGORIES;

export function isBudgetCategory(value: unknown): value is BudgetCategory {
	return typeof value === "string" && Object.hasOwn(BUDGET_CATEGORIES, value);
}

export type BudgetLineAmounts = {
	category: BudgetCategory;
	description: string;
	quantity: number;
	unitAmount: number;
};

export type BudgetTotals = {
	sparePartsAmount: number;
	labourAmount: number;
	otherChargesAmount: number;
	discount: number;
	netoAmount: number;
	ivaAmount: number;
	totalAmount: number;
	/** Monto de cada línea (cantidad × precio, redondeado a CLP), en el mismo orden. */
	lineAmounts: number[];
};

/** Líneas → ítems de cotizacion-cl (precios netos en CLP, afectos a IVA). */
export function toItems(lines: BudgetLineAmounts[]): ItemInput[] {
	return lines.map((line) => ({
		descripcion: line.description,
		cantidad: line.quantity,
		precioUnitario: line.unitAmount,
		extra: { category: line.category },
	}));
}

/** Descuento global en monto, sobre el neto. */
export function toAdjustments(discount: number): AjusteGlobal[] {
	return discount > 0
		? [{ tipo: "descuento", modo: "monto", valor: discount, aplicaA: "afecto", glosa: "Descuento" }]
		: [];
}

/**
 * Montos del presupuesto a partir de las líneas y el descuento, calculados con
 * cotizacion-cl (redondeo CLP, IVA 19 %). Los montos por categoría son la suma
 * de las líneas antes del descuento: neto = repuestos + mano de obra + otros − descuento.
 */
export function totalsFrom(
	lineas: { montoItem: number }[],
	categories: BudgetCategory[],
	totales: { descuentosGlobales: number; montoNeto: number; iva: number; total: number },
): BudgetTotals {
	const byCategory: Record<BudgetCategory, number> = { repuesto: 0, mano_obra: 0, otro: 0 };
	lineas.forEach((linea, i) => {
		byCategory[categories[i]] += linea.montoItem;
	});
	return {
		sparePartsAmount: byCategory.repuesto,
		labourAmount: byCategory.mano_obra,
		otherChargesAmount: byCategory.otro,
		discount: totales.descuentosGlobales,
		netoAmount: totales.montoNeto,
		ivaAmount: totales.iva,
		totalAmount: totales.total,
		lineAmounts: lineas.map((l) => l.montoItem),
	};
}

/**
 * Cálculo para la vista previa (sin emisor/receptor). Devuelve los errores de
 * la librería en lugar de lanzar.
 */
export function previewTotals(
	lines: BudgetLineAmounts[],
	discount: number,
): { ok: true; totals: BudgetTotals } | { ok: false; errors: ErrorValidacion[] } {
	try {
		const result = calcular({
			items: toItems(lines),
			ajustesGlobales: toAdjustments(discount),
			moneda: "CLP",
		});
		return {
			ok: true,
			totals: totalsFrom(result.lineas, lines.map((l) => l.category), result.totales),
		};
	} catch (error) {
		if (error instanceof CotizacionError) return { ok: false, errors: error.errores };
		throw error;
	}
}
