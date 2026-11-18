"use client";

import {
	Button,
	Empty,
	Flex,
	Segmented,
	Table,
	Tag,
	Tooltip,
	type TableColumnsType,
} from "antd";
import { ClockIcon, MinusIcon, PlusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { BUDGET_CATEGORIES } from "@/lib/budgets/calculation";
import { PERIODS, type Period, type PeriodKey } from "@/lib/dashboard/period";
import type { Dashboard as DashboardData } from "@/lib/dashboard/queries";
import { formatCLP, formatCompactCLP, formatDate } from "@/lib/format";
import styles from "./dashboard.module.css";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = [
	"enero",
	"febrero",
	"marzo",
	"abril",
	"mayo",
	"junio",
	"julio",
	"agosto",
	"septiembre",
	"octubre",
	"noviembre",
	"diciembre",
];

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-CL")} ${n === 1 ? one : many}`;

type DashboardProps = {
	data: DashboardData;
	period: Period;
	expiringDays: number;
	/** Nombre de pila para el saludo (o `null`). */
	firstName: string | null;
};

/** Sujeto de la frase principal según el periodo: "En noviembre", "En 2026"… */
function periodLead(period: Period): string {
	const [year, month] = period.current.from.split("-").map(Number);
	switch (period.key) {
		case "mes":
			return `En ${MONTHS_LONG[month - 1]}`;
		case "anio":
			return `En ${year}`;
		default:
			return `En los ${period.label.toLowerCase()}`;
	}
}

export function Dashboard({ data, period, expiringDays, firstName }: DashboardProps) {
	const router = useRouter();
	const pathname = usePathname();
	const [loading, startTransition] = useTransition();

	function onPeriodChange(key: PeriodKey) {
		startTransition(() => router.replace(key === "mes" ? pathname : `${pathname}?periodo=${key}`, { scroll: false }));
	}

	const { current, previous } = data;
	const average = current.count > 0 ? current.total / current.count : 0;
	const previousAverage = previous.count > 0 ? previous.total / previous.count : 0;
	const lead = periodLead(period);

	return (
		<div className={`${styles.root} ${loading ? styles.loading : ""}`} aria-busy={loading}>
			<header className={styles.hero}>
				<div className={styles.heroText}>
					<p className={styles.greeting}>{firstName ? `Hola, ${firstName}` : "Hola"}</p>
					<h1 className={styles.headline}>
						{current.count > 0
							? `${lead} llevas ${formatCLP(current.total)} presupuestados en ${plural(current.count, "presupuesto", "presupuestos")}.`
							: `${lead} aún no hay presupuestos.`}
					</h1>
					<div className={styles.heroMeta}>
						{current.count > 0 ? (
							<>
								<Delta current={current.total} previous={previous.total} period={period} money />
								<span className={styles.caption}>Montos con IVA. Neto: {formatCLP(current.neto)}.</span>
							</>
						) : (
							<Link href="/budgets/new-budget">
								<Button type="primary" icon={<PlusIcon size={16} />}>
									Crear el primero
								</Button>
							</Link>
						)}
					</div>
				</div>
				{/* Filtro único: acota todo lo que está debajo. */}
				<div className={styles.filter}>
					<Segmented<PeriodKey>
						value={period.key}
						onChange={onPeriodChange}
						options={(Object.keys(PERIODS) as PeriodKey[]).map((value) => ({
							value,
							label: PERIODS[value],
						}))}
					/>
					<span className={styles.caption}>
						Del {formatDate(period.current.from)} al {formatDate(period.current.to)}
					</span>
				</div>
			</header>

			<section className={styles.strip} aria-label="Indicadores del periodo">
				<Stat
					label="Presupuestos emitidos"
					value={current.count.toLocaleString("es-CL")}
					delta={<Delta current={current.count} previous={previous.count} period={period} />}
					note={current.annulled > 0 ? `${plural(current.annulled, "anulado", "anulados")}, no se cuentan` : undefined}
				/>
				<Stat
					label="Ticket promedio"
					value={current.count > 0 ? formatCLP(average) : "—"}
					delta={
						current.count > 0 ? (
							<Delta current={average} previous={previousAverage} period={period} money />
						) : undefined
					}
				/>
				<Stat
					label="En cartera hoy"
					value={formatCLP(data.open.total)}
					delta={
						data.open.expiringSoon > 0 ? (
							<span className={`${styles.delta} ${styles.down}`}>
								<ClockIcon size={14} aria-hidden />
								{plural(data.open.expiringSoon, "vence", "vencen")} en {expiringDays} días
							</span>
						) : undefined
					}
					note={plural(data.open.count, "presupuesto vigente", "presupuestos vigentes")}
				/>
				<Stat
					label="Clientes atendidos"
					value={current.clients.toLocaleString("es-CL")}
					note={`De ${plural(data.clients.active, "cliente activo", "clientes activos")}${
						data.clients.newInPeriod > 0 ? `, ${plural(data.clients.newInPeriod, "nuevo", "nuevos")}` : ""
					}. ${plural(data.vehicles.active, "vehículo registrado", "vehículos registrados")}.`}
					href="/clients"
				/>
			</section>

			<div className={styles.grid}>
				<div className={styles.wide}>
					<ExpiringCard expiring={data.expiring} days={expiringDays} />
				</div>
				<div className={styles.narrow}>
					<Panel title="¿En qué se presupuesta?">
						<Composition composition={data.composition} />
					</Panel>
				</div>

				<div className={styles.wide}>
					<MonthlyCard monthly={data.monthly} />
				</div>
				<div className={styles.narrow}>
					<Panel title="Por trabajador">
						<RankedBars
							empty="Sin presupuestos en el periodo."
							items={data.byUser.map((u) => ({
								key: u.name,
								name: u.name,
								value: u.total,
								detail: plural(u.count, "presupuesto", "presupuestos"),
							}))}
						/>
					</Panel>
				</div>

				<div className={styles.half}>
					<Panel title="Servicios más presupuestados">
						<RankedBars
							empty="Sin líneas en el periodo."
							items={data.topServices.map((s) => ({
								key: s.name,
								name: s.name,
								value: s.total,
								detail: plural(s.lines, "línea", "líneas"),
							}))}
						/>
					</Panel>
				</div>
				<div className={styles.half}>
					<Panel title="Mejores clientes" extra={<Link href="/clients">Ver clientes</Link>}>
						<RankedBars
							empty="Sin presupuestos en el periodo."
							items={data.topClients.map((c) => ({
								key: String(c.id),
								name: c.name,
								value: c.total,
								detail: plural(c.count, "presupuesto", "presupuestos"),
								href: `/clients/${c.id}`,
							}))}
						/>
					</Panel>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

/** Sección del inicio: superficie blanca con borde fino, título en la condensada. */
function Panel({
	title,
	extra,
	tone,
	children,
}: {
	title: string;
	extra?: ReactNode;
	/** "attention": franja amarilla a la izquierda (lo que requiere acción). */
	tone?: "attention";
	children: ReactNode;
}) {
	return (
		<section className={`${styles.panel} ${tone === "attention" ? styles.attention : ""}`}>
			<div className={styles.panelHead}>
				<h2 className={styles.panelTitle}>{title}</h2>
				{extra}
			</div>
			{children}
		</section>
	);
}

function Stat({
	label,
	value,
	delta,
	note,
	href,
}: {
	label: string;
	value: string;
	delta?: ReactNode;
	note?: string;
	href?: string;
}) {
	return (
		<div className={styles.stat}>
			<span className={styles.statLabel}>{href ? <Link href={href}>{label}</Link> : label}</span>
			<span className={styles.statValue}>{value}</span>
			{delta}
			{note && <span className={styles.caption}>{note}</span>}
		</div>
	);
}

/** Variación vs el periodo anterior: icono + texto (nunca solo color). */
function Delta({
	current,
	previous,
	period,
	money = false,
}: {
	current: number;
	previous: number;
	period: Period;
	money?: boolean;
}) {
	const previousText = money ? formatCLP(previous) : previous.toLocaleString("es-CL");
	const hint = `Del ${formatDate(period.previous.from)} al ${formatDate(period.previous.to)}: ${previousText}`;

	if (previous === 0) {
		return (
			<Tooltip title={hint}>
				<span className={`${styles.delta} ${styles.flat}`}>
					<MinusIcon size={14} aria-hidden />
					Sin datos en el {period.previousLabel}
				</span>
			</Tooltip>
		);
	}

	const rounded = Math.round(((current - previous) / previous) * 100);
	const kind = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
	const Icon = kind === "up" ? TrendingUpIcon : kind === "down" ? TrendingDownIcon : MinusIcon;

	return (
		<Tooltip title={hint}>
			<span className={`${styles.delta} ${styles[kind]}`}>
				<Icon size={14} aria-hidden />
				{rounded > 0 ? "+" : ""}
				{rounded.toLocaleString("es-CL")} % vs {period.previousLabel}
			</span>
		</Tooltip>
	);
}

// ---------------------------------------------------------------------------
// Presupuestado por mes (columnas + vista de tabla)
// ---------------------------------------------------------------------------

/** Máximo "redondo" del eje y su paso (1, 2 o 5 × 10ⁿ) para `ticks` divisiones. */
function niceScale(max: number, ticks = 4): { max: number; step: number } {
	if (max <= 0) return { max: 1, step: 0.25 };
	const raw = max / ticks;
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
	return { max: step * ticks, step };
}

function monthLabel(month: string, long = false) {
	const [year, m] = month.split("-").map(Number);
	return long ? `${MONTHS_LONG[m - 1]} ${year}` : MONTHS[m - 1];
}

function MonthlyCard({ monthly }: { monthly: DashboardData["monthly"] }) {
	const [view, setView] = useState<"chart" | "table">("chart");
	const total12 = monthly.reduce((sum, m) => sum + m.total, 0);
	const count12 = monthly.reduce((sum, m) => sum + m.count, 0);

	return (
		<Panel
			title="Presupuestado por mes"
			extra={
				<Segmented<"chart" | "table">
					size="small"
					value={view}
					onChange={setView}
					options={[
						{ value: "chart", label: "Gráfico" },
						{ value: "table", label: "Tabla" },
					]}
				/>
			}
		>
			<p className={styles.caption} style={{ marginBottom: 16 }}>
				Últimos 12 meses: {formatCLP(total12)} en {plural(count12, "presupuesto", "presupuestos")}, con IVA y sin
				anulados.
			</p>
			{count12 === 0 ? (
				<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aún no hay presupuestos en los últimos 12 meses." />
			) : view === "chart" ? (
				<MonthlyColumns monthly={monthly} />
			) : (
				<Table
					size="small"
					pagination={false}
					rowKey="month"
					dataSource={[...monthly].reverse()}
					columns={[
						{ title: "Mes", dataIndex: "month", render: (m: string) => monthLabel(m, true) },
						{ title: "Presupuestos", dataIndex: "count", align: "right" },
						{ title: "Total", dataIndex: "total", align: "right", render: (v: number) => formatCLP(v) },
					]}
				/>
			)}
		</Panel>
	);
}

function MonthlyColumns({ monthly }: { monthly: DashboardData["monthly"] }) {
	const { max, step } = useMemo(() => niceScale(Math.max(...monthly.map((m) => m.total))), [monthly]);
	const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
	const peak = monthly.reduce((best, m, i) => (m.total > monthly[best].total ? i : best), 0);
	const last = monthly.length - 1;

	return (
		<div>
			<div className={styles.columns}>
				{ticks.map((tick) => (
					<div key={tick} className={styles.gridline} style={{ bottom: `${(tick / max) * 100}%` }}>
						<span className={styles.tick}>{formatCompactCLP(tick)}</span>
					</div>
				))}
				<div className={styles.slots}>
					{monthly.map((m, i) => (
						<Tooltip
							key={m.month}
							title={
								<Flex vertical>
									<strong>{formatCLP(m.total)}</strong>
									<span>
										{monthLabel(m.month, true)}
										{i === last ? " (en curso)" : ""}, {plural(m.count, "presupuesto", "presupuestos")}
									</span>
								</Flex>
							}
						>
							<div
								className={styles.slot}
								tabIndex={0}
								aria-label={`${monthLabel(m.month, true)}: ${formatCLP(m.total)}, ${plural(m.count, "presupuesto", "presupuestos")}`}
							>
								{m.total > 0 && (
									<div className={styles.bar} style={{ height: `${(m.total / max) * 100}%` }}>
										{/* Etiqueta directa solo en el máximo y en el mes en curso. */}
										{(i === peak || i === last) && (
											<span className={styles.barLabel}>{formatCompactCLP(m.total)}</span>
										)}
									</div>
								)}
							</div>
						</Tooltip>
					))}
				</div>
			</div>
			<div className={styles.months} aria-hidden>
				{monthly.map((m, i) => (
					<span key={m.month} className={i === last ? styles.currentMonth : undefined}>
						{monthLabel(m.month)}
						{m.month.endsWith("-01") || i === 0 ? ` ${m.month.slice(2, 4)}` : ""}
					</span>
				))}
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Composición: repuestos / mano de obra / otros (barra segmentada)
// ---------------------------------------------------------------------------

function Composition({ composition }: { composition: DashboardData["composition"] }) {
	const parts = [
		{ key: "repuesto", label: BUDGET_CATEGORIES.repuesto, value: composition.spareParts, color: "var(--series-1)" },
		{ key: "mano_obra", label: BUDGET_CATEGORIES.mano_obra, value: composition.labour, color: "var(--series-2)" },
		{ key: "otro", label: BUDGET_CATEGORIES.otro, value: composition.other, color: "var(--series-3)" },
	];
	const sum = parts.reduce((s, p) => s + p.value, 0);
	if (sum === 0)
		return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin presupuestos en el periodo." />;

	const pct = (v: number) => `${Math.round((v / sum) * 100)} %`;

	return (
		<Flex vertical gap="middle">
			<div className={styles.segmented}>
				{parts
					.filter((p) => p.value > 0)
					.map((p) => (
						<Tooltip
							key={p.key}
							title={
								<Flex vertical>
									<strong>{formatCLP(p.value)}</strong>
									<span>
										{p.label}, {pct(p.value)}
									</span>
								</Flex>
							}
						>
							<div
								className={styles.segment}
								tabIndex={0}
								aria-label={`${p.label}: ${formatCLP(p.value)} (${pct(p.value)})`}
								style={{ flexGrow: p.value, flexBasis: 0, background: p.color }}
							/>
						</Tooltip>
					))}
			</div>
			{/* Leyenda con valores: identifica cada tramo sin depender del color. */}
			<Flex vertical gap={8}>
				{parts.map((p) => (
					<Flex key={p.key} align="center" gap={8}>
						<span className={styles.swatch} style={{ background: p.color }} aria-hidden />
						<span style={{ flex: 1 }}>{p.label}</span>
						<span className={styles.rankValue}>{formatCLP(p.value)}</span>
						<span className={styles.caption} style={{ width: 40, textAlign: "right" }}>
							{pct(p.value)}
						</span>
					</Flex>
				))}
			</Flex>
			<span className={styles.caption}>
				Montos netos antes de descuentos.
				{composition.discount > 0 ? ` Descuentos otorgados: ${formatCLP(composition.discount)}.` : ""}
			</span>
		</Flex>
	);
}

// ---------------------------------------------------------------------------
// Barras horizontales ordenadas
// ---------------------------------------------------------------------------

type RankedItem = { key: string; name: string; value: number; detail: string; href?: string };

function RankedBars({ items, empty }: { items: RankedItem[]; empty: string }) {
	if (items.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} />;
	const max = Math.max(...items.map((i) => i.value), 1);

	return (
		<Flex vertical gap={14}>
			{items.map((item) => {
				const row = (
					<div className={styles.rankRow} tabIndex={0} aria-label={`${item.name}: ${formatCLP(item.value)}, ${item.detail}`}>
						<span className={styles.rankName}>{item.name}</span>
						<span className={styles.rankValue}>{formatCompactCLP(item.value)}</span>
						<div className={styles.rankTrack}>
							<div className={styles.rankBar} style={{ width: `${(item.value / max) * 100}%` }} />
						</div>
					</div>
				);
				return (
					<Tooltip
						key={item.key}
						placement="topLeft"
						title={
							<Flex vertical>
								<strong>{formatCLP(item.value)}</strong>
								<span>
									{item.name}, {item.detail}
								</span>
							</Flex>
						}
					>
						{item.href ? (
							<Link href={item.href} style={{ color: "inherit" }}>
								{row}
							</Link>
						) : (
							row
						)}
					</Tooltip>
				);
			})}
		</Flex>
	);
}

// ---------------------------------------------------------------------------
// Por vencer
// ---------------------------------------------------------------------------

type ExpiringRow = DashboardData["expiring"][number];

function ExpiringCard({ expiring, days }: { expiring: ExpiringRow[]; days: number }) {
	const columns: TableColumnsType<ExpiringRow> = [
		{
			title: "Código",
			dataIndex: "code",
			render: (code: string) => <Link href={`/budgets/${code}`}>{code}</Link>,
		},
		{ title: "Cliente", dataIndex: "clientName", ellipsis: true },
		{ title: "Patente", dataIndex: "plate", width: 100 },
		{
			title: "Vence",
			dataIndex: "daysLeft",
			width: 170,
			render: (daysLeft: number, row) => (
				<Flex gap={6} align="center" wrap>
					<span>{formatDate(row.expiresOn)}</span>
					<Tag color={daysLeft <= 2 ? "orange" : undefined} icon={<ClockIcon size={12} style={{ marginRight: 4 }} />}>
						{daysLeft === 0 ? "hoy" : daysLeft === 1 ? "mañana" : `en ${daysLeft} días`}
					</Tag>
				</Flex>
			),
		},
		{ title: "Total", dataIndex: "total", align: "right", width: 130, render: (v: number) => formatCLP(v) },
	];

	return (
		<Panel
			title={`Por vencer en los próximos ${days} días`}
			tone="attention"
			extra={<Link href="/budgets?status=vigente">Ver vigentes</Link>}
		>
			<p className={styles.caption} style={{ marginBottom: 12 }}>
				Llama al cliente antes de que el presupuesto caduque.
			</p>
			<Table<ExpiringRow>
				size="small"
				rowKey="code"
				columns={columns}
				dataSource={expiring}
				pagination={false}
				scroll={{ x: 600 }}
				locale={{ emptyText: `Nada vence en los próximos ${days} días.` }}
			/>
		</Panel>
	);
}
