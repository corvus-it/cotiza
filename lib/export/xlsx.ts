import "server-only";
import ExcelJS from "exceljs";

/** Formatos de celda en Excel (configuración regional del usuario para separadores). */
export const XLSX_FORMATS = {
	clp: '"$"#,##0',
	date: "dd-mm-yyyy",
	integer: "#,##0",
} as const;

export type XlsxColumn<T> = {
	header: string;
	value: (row: T) => string | number | Date | null | undefined;
	/** Ancho en caracteres. */
	width?: number;
	numFmt?: string;
};

/** "YYYY-MM-DD" → `Date` en UTC (Excel la muestra sin desfase de zona horaria). */
export function isoToDate(iso: string | null | undefined): Date | null {
	const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
	return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
}

/** Nombre de archivo con la fecha de hoy en Chile: `presupuestos-2026-11-19.xlsx`. */
export function xlsxFilename(base: string): string {
	const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
	return `${base}-${today}.xlsx`;
}

/**
 * Libro de una hoja con encabezado en negrita, fila superior fija y autofiltro,
 * servido como descarga.
 */
export async function xlsxResponse<T>(options: {
	filename: string;
	sheetName: string;
	columns: XlsxColumn<T>[];
	rows: T[];
	creator?: string;
}): Promise<Response> {
	const { filename, sheetName, columns, rows, creator } = options;
	const workbook = new ExcelJS.Workbook();
	workbook.creator = creator ?? "Cotiza";
	workbook.created = new Date();

	const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
	sheet.columns = columns.map((c, i) => ({
		key: String(i),
		header: c.header,
		width: c.width ?? Math.max(12, c.header.length + 2),
		style: c.numFmt ? { numFmt: c.numFmt } : undefined,
	}));
	sheet.getRow(1).font = { bold: true };
	sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };

	for (const row of rows) {
		sheet.addRow(Object.fromEntries(columns.map((c, i) => [String(i), c.value(row) ?? null])));
	}
	if (rows.length > 0) {
		sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
	}

	const buffer = await workbook.xlsx.writeBuffer();
	return new Response(new Uint8Array(buffer as ArrayBuffer), {
		headers: {
			"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Cache-Control": "private, no-store",
		},
	});
}
