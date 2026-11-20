import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatearRut } from "cotizacion-cl";
import type { Company } from "@/lib/db/schemas";
import { formatCLP, formatDate } from "@/lib/format";
import { BUDGET_CATEGORIES, previewTotals } from "./calculation";
import type { BudgetFull } from "./queries";
import { BUDGET_STATUSES } from "./status";

/*
 * PDF del presupuesto con @react-pdf/renderer (JS puro: sin Chromium, apto
 * para funciones serverless). Usa Helvetica, incluida en todo lector PDF,
 * que cubre tildes, ñ, º y —.
 */

type Logo = { data: Buffer; format: "png" | "jpg" };

const INK = "#1f2328";
const MUTED = "#656d76";
const LINE = "#d0d7de";
const SOFT = "#f6f8fa";
const ACCENT = "#1f4e8c";

const s = StyleSheet.create({
	page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontSize: 9, color: INK, fontFamily: "Helvetica" },
	header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
	companyBlock: { flexDirection: "row", gap: 10, maxWidth: "60%" },
	logo: { width: 56, height: 56, objectFit: "contain" },
	companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 },
	muted: { color: MUTED },
	docBox: { borderWidth: 1.5, borderColor: ACCENT, borderRadius: 4, padding: 8, alignItems: "center", minWidth: 150 },
	docTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: ACCENT },
	docNumber: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 2 },
	status: { marginTop: 4, fontSize: 8, color: MUTED },
	annulled: { marginTop: 4, fontSize: 10, fontFamily: "Helvetica-Bold", color: "#b42318" },
	// Franja con los datos del documento: fechas y responsable.
	metaStrip: {
		flexDirection: "row",
		backgroundColor: SOFT,
		borderWidth: 1,
		borderColor: LINE,
		borderRadius: 4,
		marginBottom: 12,
	},
	metaCell: { flex: 1, paddingVertical: 6, paddingHorizontal: 8 },
	metaDivider: { borderLeftWidth: 1, borderColor: LINE },
	// Cliente y vehículo, lado a lado.
	partiesRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
	party: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 4 },
	partyTitle: {
		fontSize: 8,
		fontFamily: "Helvetica-Bold",
		color: ACCENT,
		textTransform: "uppercase",
		letterSpacing: 0.6,
		paddingVertical: 5,
		paddingHorizontal: 8,
		borderBottomWidth: 1,
		borderColor: LINE,
	},
	grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingTop: 6, paddingBottom: 2 },
	field: { width: "50%", paddingRight: 6, marginBottom: 6 },
	fieldWide: { width: "100%" },
	label: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 1.5 },
	value: { fontSize: 9.5 },
	valueStrong: { fontSize: 11, fontFamily: "Helvetica-Bold" },
	plate: {
		alignSelf: "flex-start",
		fontSize: 11,
		fontFamily: "Helvetica-Bold",
		letterSpacing: 1,
		borderWidth: 1,
		borderColor: INK,
		borderRadius: 2,
		paddingHorizontal: 4,
		paddingTop: 1.5,
	},
	sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4, marginTop: 6 },
	paragraph: { lineHeight: 1.4, marginBottom: 8 },
	table: { borderWidth: 1, borderColor: LINE, borderRadius: 4, marginBottom: 12 },
	tr: { flexDirection: "row", borderTopWidth: 1, borderColor: LINE },
	th: { flexDirection: "row", backgroundColor: SOFT, fontFamily: "Helvetica-Bold" },
	cell: { paddingVertical: 5, paddingHorizontal: 6 },
	cCat: { width: "17%" },
	cDesc: { width: "43%" },
	cQty: { width: "10%", textAlign: "right" },
	cUnit: { width: "15%", textAlign: "right" },
	cAmt: { width: "15%", textAlign: "right" },
	totalsWrap: { flexDirection: "row", justifyContent: "flex-end" },
	totals: { width: 220 },
	totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
	grandTotal: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 4,
		paddingTop: 6,
		borderTopWidth: 1.5,
		borderColor: INK,
		fontSize: 11,
		fontFamily: "Helvetica-Bold",
	},
	footer: {
		position: "absolute",
		bottom: 24,
		left: 40,
		right: 40,
		flexDirection: "row",
		justifyContent: "space-between",
		fontSize: 7.5,
		color: MUTED,
		borderTopWidth: 1,
		borderColor: LINE,
		paddingTop: 6,
	},
});

function rut(value: string): string {
	try {
		return formatearRut(value);
	} catch {
		return value;
	}
}

/** Etiqueta arriba, valor abajo. Sin dato muestra "—" para mantener la cuadrícula. */
function Field({
	label,
	value,
	wide = false,
	strong = false,
}: {
	label: string;
	value: string | number | null | undefined;
	wide?: boolean;
	strong?: boolean;
}) {
	return (
		<View style={wide ? [s.field, s.fieldWide] : s.field}>
			<Text style={s.label}>{label}</Text>
			<Text style={strong ? s.valueStrong : s.value}>{value || value === 0 ? String(value) : "—"}</Text>
		</View>
	);
}

function MetaCell({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
	return (
		<View style={first ? s.metaCell : [s.metaCell, s.metaDivider]}>
			<Text style={s.label}>{label}</Text>
			<Text style={s.value}>{value}</Text>
		</View>
	);
}

function BudgetDocument({ budget, company, logo }: { budget: BudgetFull; company: Company; logo: Logo | null }) {
	// Montos por línea con el mismo redondeo que al guardar; los totales son los almacenados.
	const preview = previewTotals(budget.lines, budget.discount);
	const lineAmounts = preview.ok
		? preview.totals.lineAmounts
		: budget.lines.map((l) => Math.round(l.quantity * l.unitAmount));
	const location = [company.address, company.commune, company.city].filter(Boolean).join(", ");
	const annulled = budget.status === "anulado";

	return (
		<Document title={`Presupuesto ${budget.code}`} author={company.name} creator={company.name} language="es-CL">
			<Page size="LETTER" style={s.page}>
				<View style={s.header} fixed>
					<View style={s.companyBlock}>
						{/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, no <img> */}
						{logo && <Image src={logo} style={s.logo} />}
						<View>
							<Text style={s.companyName}>{company.name}</Text>
							<Text>RUT {rut(company.rut)}</Text>
							{company.businessActivity && <Text style={s.muted}>{company.businessActivity}</Text>}
							{location && <Text style={s.muted}>{location}</Text>}
							{(company.phone || company.email) && (
								<Text style={s.muted}>{[company.phone, company.email].filter(Boolean).join(" · ")}</Text>
							)}
							{company.website && <Text style={s.muted}>{company.website}</Text>}
						</View>
					</View>
					<View style={s.docBox}>
						<Text style={s.docTitle}>PRESUPUESTO</Text>
						<Text style={s.docNumber}>N.º {budget.budgetNumber}</Text>
						<Text style={s.muted}>{budget.code}</Text>
						{annulled ? (
							<Text style={s.annulled}>ANULADO</Text>
						) : (
							<Text style={s.status}>{BUDGET_STATUSES[budget.status].label}</Text>
						)}
					</View>
				</View>

				<View style={s.metaStrip}>
					<MetaCell first label="Fecha de emisión" value={formatDate(budget.date)} />
					<MetaCell
						label="Válido hasta"
						value={`${formatDate(budget.expiresOn)} (${budget.validityDays} ${budget.validityDays === 1 ? "día" : "días"})`}
					/>
					<MetaCell label="Entrega estimada" value={formatDate(budget.estimatedDeliveryDate)} />
					<MetaCell label="Atendido por" value={budget.userName} />
				</View>

				<View style={s.partiesRow}>
					<View style={s.party}>
						<Text style={s.partyTitle}>Cliente</Text>
						<View style={s.grid}>
							<Field wide strong label="Nombre o razón social" value={budget.clientName} />
							<Field label="RUT" value={rut(budget.clientRut)} />
							<Field label="Teléfono" value={budget.clientPhone} />
							<Field wide label="Correo" value={budget.clientEmail} />
						</View>
					</View>
					<View style={s.party}>
						<Text style={s.partyTitle}>Vehículo</Text>
						<View style={s.grid}>
							<View style={s.field}>
								<Text style={s.label}>Patente</Text>
								<Text style={s.plate}>{budget.plate}</Text>
							</View>
							<Field label="Año" value={budget.vehicleYear} />
							<Field label="Marca" value={budget.brand} />
							<Field label="Modelo" value={budget.model} />
						</View>
					</View>
				</View>

				{budget.diagnosis && (
					<View wrap={false}>
						<Text style={s.sectionTitle}>Diagnóstico</Text>
						<Text style={s.paragraph}>{budget.diagnosis}</Text>
					</View>
				)}

				<Text style={s.sectionTitle}>Detalle</Text>
				<View style={s.table}>
					<View style={s.th} fixed>
						<Text style={[s.cell, s.cCat]}>Tipo</Text>
						<Text style={[s.cell, s.cDesc]}>Descripción</Text>
						<Text style={[s.cell, s.cQty]}>Cant.</Text>
						<Text style={[s.cell, s.cUnit]}>P. unitario</Text>
						<Text style={[s.cell, s.cAmt]}>Monto</Text>
					</View>
					{budget.lines.map((line, i) => (
						<View key={i} style={s.tr} wrap={false}>
							<Text style={[s.cell, s.cCat]}>{BUDGET_CATEGORIES[line.category]}</Text>
							<Text style={[s.cell, s.cDesc]}>{line.description}</Text>
							<Text style={[s.cell, s.cQty]}>{line.quantity.toLocaleString("es-CL")}</Text>
							<Text style={[s.cell, s.cUnit]}>{formatCLP(line.unitAmount)}</Text>
							<Text style={[s.cell, s.cAmt]}>{formatCLP(lineAmounts[i] ?? 0)}</Text>
						</View>
					))}
				</View>

				<View style={s.totalsWrap} wrap={false}>
					<View style={s.totals}>
						<TotalRow label="Repuestos" value={budget.sparePartsAmount} />
						<TotalRow label="Mano de obra" value={budget.labourAmount} />
						{budget.otherChargesAmount > 0 && <TotalRow label="Otros cargos" value={budget.otherChargesAmount} />}
						{budget.discount > 0 && <TotalRow label="Descuento" value={-budget.discount} />}
						<TotalRow label="Neto" value={budget.netoAmount} />
						<TotalRow label="IVA (19 %)" value={budget.ivaAmount} />
						<View style={s.grandTotal}>
							<Text>Total</Text>
							<Text>{formatCLP(budget.totalAmount)}</Text>
						</View>
					</View>
				</View>

				{budget.additionalObservations && (
					<View wrap={false}>
						<Text style={s.sectionTitle}>Observaciones</Text>
						<Text style={s.paragraph}>{budget.additionalObservations}</Text>
					</View>
				)}

				<View style={s.footer} fixed>
					<Text>
						{company.name} · Presupuesto {budget.code} · Válido hasta el {formatDate(budget.expiresOn)}
					</Text>
					<Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
				</View>
			</Page>
		</Document>
	);
}

function TotalRow({ label, value }: { label: string; value: number }) {
	return (
		<View style={s.totalRow}>
			<Text style={s.muted}>{label}</Text>
			<Text>{value < 0 ? `−${formatCLP(-value)}` : formatCLP(value)}</Text>
		</View>
	);
}

/**
 * Descarga el logo de la empresa (URL pública) para incrustarlo. Solo PNG/JPEG
 * y con límite de tiempo y tamaño: si falla, el PDF sale sin logo.
 */
async function loadLogo(url: string | null): Promise<Logo | null> {
	if (!url) return null;
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(3000), cache: "no-store" });
		if (!res.ok) return null;
		const type = res.headers.get("content-type") ?? "";
		const format = type.includes("png") ? "png" : type.includes("jpeg") || type.includes("jpg") ? "jpg" : null;
		if (!format) return null;
		const data = Buffer.from(await res.arrayBuffer());
		return data.byteLength <= 2_000_000 ? { data, format } : null;
	} catch {
		return null;
	}
}

/** PDF del presupuesto como bytes. */
export async function renderBudgetPdf(budget: BudgetFull, company: Company): Promise<Buffer> {
	const logo = await loadLogo(company.logo);
	return renderToBuffer(<BudgetDocument budget={budget} company={company} logo={logo} />);
}
