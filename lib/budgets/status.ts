/**
 * Estado derivado del presupuesto (no existe en la BD):
 *   active = false                  → anulado
 *   accepted_at IS NOT NULL         → aceptado (no vence)
 *   date + validity_days < hoy (CL) → vencido
 *   si no                           → vigente
 * Se calcula en SQL (ver `lib/budgets/queries.ts`).
 */
export const BUDGET_STATUSES = {
	vigente: { label: "Vigente", color: "green" },
	aceptado: { label: "Aceptado", color: "blue" },
	vencido: { label: "Vencido", color: "orange" },
	anulado: { label: "Anulado", color: "default" },
} as const;

export type BudgetStatus = keyof typeof BUDGET_STATUSES;

export function isBudgetStatus(value: unknown): value is BudgetStatus {
	return typeof value === "string" && Object.hasOwn(BUDGET_STATUSES, value);
}
