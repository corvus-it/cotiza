import "server-only";
import { and, asc, between, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { ofCompany, TODAY_CL } from "@/lib/budgets/queries";
import { db } from "@/lib/db";
import { budgetDetails, budgets, clients, serviceTypes, users, vehicles } from "@/lib/db/schemas";
import type { DateRange, Period } from "./period";

/*
 * Métricas del inicio. Todo se limita a la empresa del usuario (`ofCompany`)
 * y, salvo que se indique, excluye los presupuestos anulados.
 */

const num = (expr: SQL) => sql<number>`coalesce(${expr}, 0)`.mapWith(Number);
const inRange = ({ from, to }: DateRange) => between(budgets.date, from, to);
const expiresOn = sql`${budgets.date} + ${budgets.validityDays}`;

export type PeriodSummary = {
	count: number;
	total: number;
	neto: number;
	annulled: number;
	/** Clientes distintos con al menos un presupuesto. */
	clients: number;
};

export type Dashboard = {
	current: PeriodSummary;
	previous: PeriodSummary;
	/** Vigentes hoy (cualquier fecha de emisión). */
	open: { count: number; total: number; expiringSoon: number };
	clients: { active: number; newInPeriod: number };
	vehicles: { active: number };
	/** Últimos 12 meses (incluye el actual), del más antiguo al más reciente. */
	monthly: { month: string; count: number; total: number }[];
	composition: { spareParts: number; labour: number; other: number; discount: number };
	topServices: { name: string; total: number; lines: number }[];
	topClients: { id: number; name: string; total: number; count: number }[];
	byUser: { name: string; total: number; count: number }[];
	expiring: {
		code: string;
		clientName: string;
		plate: string;
		expiresOn: string;
		daysLeft: number;
		total: number;
	}[];
};

/** Días hacia adelante para "por vencer". */
export const EXPIRING_DAYS = 7;

async function summary(companyId: number, range: DateRange): Promise<PeriodSummary> {
	const [row] = await db
		.select({
			count: num(sql`count(*) filter (where ${budgets.active})`),
			total: num(sql`sum(${budgets.totalAmount}) filter (where ${budgets.active})`),
			neto: num(sql`sum(${budgets.netoAmount}) filter (where ${budgets.active})`),
			annulled: num(sql`count(*) filter (where not ${budgets.active})`),
			clients: num(sql`count(distinct ${budgets.clientId}) filter (where ${budgets.active})`),
		})
		.from(budgets)
		.where(and(ofCompany(companyId), inRange(range)));
	return row;
}

export async function getDashboard(companyId: number, period: Period): Promise<Dashboard> {
	const company = ofCompany(companyId);
	const current = and(company, eq(budgets.active, true), inRange(period.current));

	const [
		currentSummary,
		previousSummary,
		[open],
		[clientCounts],
		[vehicleCounts],
		monthly,
		[composition],
		topServices,
		topClients,
		byUser,
		expiring,
	] = await Promise.all([
		summary(companyId, period.current),
		summary(companyId, period.previous),

		db
			.select({
				count: num(sql`count(*)`),
				total: num(sql`sum(${budgets.totalAmount})`),
				expiringSoon: num(sql`count(*) filter (where ${expiresOn} <= ${TODAY_CL} + ${EXPIRING_DAYS}::int)`),
			})
			.from(budgets)
			.where(and(company, eq(budgets.active, true), gte(expiresOn, TODAY_CL))),

		db
			.select({
				active: num(sql`count(*)`),
				newInPeriod: num(
					sql`count(*) filter (where (${clients.createdAt} AT TIME ZONE 'America/Santiago')::date between ${period.current.from} and ${period.current.to})`,
				),
			})
			.from(clients)
			.where(and(eq(clients.companyId, companyId), eq(clients.active, true))),

		db
			.select({ active: num(sql`count(*)`) })
			.from(vehicles)
			.where(and(eq(vehicles.companyId, companyId), eq(vehicles.active, true))),

		// generate_series asegura los 12 meses aunque no haya presupuestos.
		db
			.execute<{ month: string; count: number; total: number }>(
				sql`
				with months as (
					select generate_series(
						date_trunc('month', ${TODAY_CL}) - interval '11 months',
						date_trunc('month', ${TODAY_CL}),
						interval '1 month'
					)::date as month
				)
				select to_char(m.month, 'YYYY-MM') as month,
					count(${budgets.id})::int as count,
					coalesce(sum(${budgets.totalAmount}), 0)::float8 as total
				from months m
				left join ${budgets}
					on date_trunc('month', ${budgets.date})::date = m.month
					and ${budgets.active}
					and ${ofCompany(companyId)}
				group by m.month
				order by m.month`,
			)
			.then((r) => r.rows.map((row) => ({ ...row, count: Number(row.count), total: Number(row.total) }))),

		db
			.select({
				spareParts: num(sql`sum(${budgets.sparePartsAmount})`),
				labour: num(sql`sum(${budgets.labourAmount})`),
				other: num(sql`sum(${budgets.otherChargesAmount})`),
				discount: num(sql`sum(${budgets.discount})`),
			})
			.from(budgets)
			.where(current),

		db
			.select({
				name: serviceTypes.name,
				total: num(sql`sum(${budgetDetails.totalAmount})`),
				lines: num(sql`count(*)`),
			})
			.from(budgetDetails)
			.innerJoin(budgets, eq(budgets.id, budgetDetails.budgetId))
			.innerJoin(serviceTypes, eq(serviceTypes.id, budgetDetails.serviceTypeId))
			.where(current)
			.groupBy(serviceTypes.id, serviceTypes.name)
			.orderBy(desc(sql`sum(${budgetDetails.totalAmount})`))
			.limit(5),

		db
			.select({
				id: clients.id,
				name: clients.name,
				total: num(sql`sum(${budgets.totalAmount})`),
				count: num(sql`count(*)`),
			})
			.from(budgets)
			.innerJoin(clients, eq(clients.id, budgets.clientId))
			.where(current)
			.groupBy(clients.id, clients.name)
			.orderBy(desc(sql`sum(${budgets.totalAmount})`))
			.limit(5),

		db
			.select({
				name: users.name,
				total: num(sql`sum(${budgets.totalAmount})`),
				count: num(sql`count(*)`),
			})
			.from(budgets)
			.innerJoin(users, eq(users.id, budgets.userId))
			.where(current)
			.groupBy(users.id, users.name)
			.orderBy(desc(sql`sum(${budgets.totalAmount})`)),

		db
			.select({
				code: budgets.code,
				clientName: clients.name,
				plate: vehicles.plate,
				expiresOn: sql<string>`to_char(${expiresOn}, 'YYYY-MM-DD')`,
				daysLeft: num(sql`(${expiresOn}) - ${TODAY_CL}`),
				total: budgets.totalAmount,
			})
			.from(budgets)
			.innerJoin(clients, eq(clients.id, budgets.clientId))
			.innerJoin(vehicles, eq(vehicles.id, budgets.vehicleId))
			.where(
				and(
					company,
					eq(budgets.active, true),
					sql`${expiresOn} between ${TODAY_CL} and ${TODAY_CL} + ${EXPIRING_DAYS}::int`,
				),
			)
			.orderBy(asc(expiresOn), desc(budgets.totalAmount))
			.limit(8),
	]);

	return {
		current: currentSummary,
		previous: previousSummary,
		open,
		clients: clientCounts,
		vehicles: vehicleCounts,
		monthly,
		composition,
		topServices,
		topClients,
		byUser,
		expiring,
	};
}
