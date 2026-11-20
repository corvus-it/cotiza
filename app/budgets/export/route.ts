import { formatearRut } from "cotizacion-cl";
import type { NextRequest } from "next/server";
import { getBudgetAccess, getCompanyBudgets, type BudgetListItem } from "@/lib/budgets/queries";
import { BUDGET_STATUSES } from "@/lib/budgets/status";
import { isoToDate, XLSX_FORMATS, xlsxFilename, xlsxResponse, type XlsxColumn } from "@/lib/export/xlsx";

/** Tope de filas por exportación (protege la memoria del servidor). */
const MAX_ROWS = 20_000;

const columns: XlsxColumn<BudgetListItem>[] = [
	{ header: "Código", value: (b) => b.code, width: 14 },
	{ header: "N.º", value: (b) => b.budgetNumber, width: 8 },
	{ header: "Fecha", value: (b) => isoToDate(b.date), numFmt: XLSX_FORMATS.date },
	{ header: "Vence", value: (b) => isoToDate(b.expiresOn), numFmt: XLSX_FORMATS.date },
	{ header: "Estado", value: (b) => BUDGET_STATUSES[b.status].label },
	{ header: "Aceptado el", value: (b) => b.acceptedAt, width: 18 },
	{ header: "RUT cliente", value: (b) => formatearRut(b.clientRut), width: 14 },
	{ header: "Cliente", value: (b) => b.clientName, width: 30 },
	{ header: "Correo cliente", value: (b) => b.clientEmail, width: 28 },
	{ header: "Patente", value: (b) => b.plate },
	{ header: "Marca", value: (b) => b.brand },
	{ header: "Modelo", value: (b) => b.model },
	{ header: "Creado por", value: (b) => b.userName, width: 22 },
	{ header: "Neto", value: (b) => b.netoAmount, numFmt: XLSX_FORMATS.clp, width: 14 },
	{ header: "IVA", value: (b) => b.ivaAmount, numFmt: XLSX_FORMATS.clp, width: 14 },
	{ header: "Total", value: (b) => b.totalAmount, numFmt: XLSX_FORMATS.clp, width: 14 },
	{ header: "Último envío", value: (b) => b.lastSent?.at, width: 18 },
	{ header: "Enviado a", value: (b) => b.lastSent?.to, width: 28 },
];

/**
 * GET /budgets/export?status=&q= → Excel con los presupuestos de la empresa,
 * con los mismos filtros que el listado (sin paginar).
 */
export async function GET(request: NextRequest) {
	const access = await getBudgetAccess();
	if (!access.ok) return new Response("Sin empresa asociada.", { status: 403 });

	const params = request.nextUrl.searchParams;
	const list = await getCompanyBudgets(access.company.id, {
		status: params.get("status") ?? undefined,
		search: params.get("q") ?? undefined,
		pageSize: MAX_ROWS,
	});

	return xlsxResponse({
		filename: xlsxFilename("presupuestos"),
		sheetName: "Presupuestos",
		columns,
		rows: list.items,
		creator: access.company.name,
	});
}
