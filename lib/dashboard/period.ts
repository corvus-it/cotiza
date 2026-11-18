/*
 * Periodos del dashboard. Se calculan sobre fechas "YYYY-MM-DD" (hoy en Chile,
 * según la BD) con aritmética UTC, sin depender de la zona del servidor.
 */

export const PERIODS = {
	mes: "Este mes",
	"30d": "Últimos 30 días",
	"90d": "Últimos 90 días",
	anio: "Este año",
} as const;

export type PeriodKey = keyof typeof PERIODS;

export type DateRange = { from: string; to: string };

export type Period = {
	key: PeriodKey;
	label: string;
	current: DateRange;
	/** Mismo largo, inmediatamente anterior (para comparar). */
	previous: DateRange;
	/** Texto para "vs …" en las variaciones. */
	previousLabel: string;
};

export function isPeriodKey(value: unknown): value is PeriodKey {
	return typeof value === "string" && Object.hasOwn(PERIODS, value);
}

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

function addDays(iso: string, days: number): string {
	const d = toDate(iso);
	d.setUTCDate(d.getUTCDate() + days);
	return toIso(d);
}

/** Mismo día `months` meses antes, recortado al último día del mes. */
function addMonthsClamped(iso: string, months: number): string {
	const [y, m, day] = iso.split("-").map(Number);
	const target = new Date(Date.UTC(y, m - 1 + months, 1));
	const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
	target.setUTCDate(Math.min(day, lastDay));
	return toIso(target);
}

export function resolvePeriod(key: PeriodKey, today: string): Period {
	const label = PERIODS[key];
	switch (key) {
		case "mes": {
			const from = `${today.slice(0, 7)}-01`;
			const prevFrom = addMonthsClamped(from, -1);
			return {
				key,
				label,
				current: { from, to: today },
				previous: { from: prevFrom, to: addMonthsClamped(today, -1) },
				previousLabel: "mismo periodo del mes anterior",
			};
		}
		case "anio": {
			const from = `${today.slice(0, 4)}-01-01`;
			return {
				key,
				label,
				current: { from, to: today },
				previous: { from: addMonthsClamped(from, -12), to: addMonthsClamped(today, -12) },
				previousLabel: "mismo periodo del año anterior",
			};
		}
		default: {
			const days = key === "30d" ? 30 : 90;
			const from = addDays(today, -(days - 1));
			return {
				key,
				label,
				current: { from, to: today },
				previous: { from: addDays(from, -days), to: addDays(from, -1) },
				previousLabel: `${days} días anteriores`,
			};
		}
	}
}
