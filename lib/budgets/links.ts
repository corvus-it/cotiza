/** Ruta del PDF del presupuesto (lo sirve `app/budgets/[budgetCode]/pdf/route.ts`). */
export function budgetPdfHref(code: string): string {
	return `/budgets/${encodeURIComponent(code)}/pdf`;
}
