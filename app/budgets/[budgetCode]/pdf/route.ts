import type { NextRequest } from "next/server";
import { getBudgetAccess, getCompanyBudget } from "@/lib/budgets/queries";
import { renderBudgetPdf } from "@/lib/budgets/pdf";

/**
 * GET /budgets/:code/pdf → PDF del presupuesto (en línea; `?download=1` para descargar).
 * Misma autorización que la página: solo presupuestos de la empresa del usuario.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/budgets/[budgetCode]/pdf">) {
	const [{ budgetCode }, access] = await Promise.all([ctx.params, getBudgetAccess()]);
	if (!access.ok) return new Response("Sin empresa asociada.", { status: 403 });

	const budget = await getCompanyBudget(access.company.id, budgetCode);
	if (!budget) return new Response("Presupuesto no encontrado.", { status: 404 });

	const pdf = await renderBudgetPdf(budget, access.company);
	const filename = `presupuesto-${budget.code.replace(/[^\w.-]/g, "_")}.pdf`;
	const disposition = request.nextUrl.searchParams.has("download") ? "attachment" : "inline";

	return new Response(new Uint8Array(pdf), {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `${disposition}; filename="${filename}"`,
			"Cache-Control": "private, no-store",
		},
	});
}
