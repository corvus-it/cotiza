import { formatearMoneda } from "cotizacion-cl";

/** "YYYY-MM-DD" → "dd-mm-aaaa" (por texto, sin `Date`: evita desfases de zona horaria). */
export function formatDate(iso: string | null | undefined): string {
	if (!iso) return "—";
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
	return match ? `${match[3]}-${match[2]}-${match[1]}` : iso;
}

/** Monto en CLP: "$1.234.567". */
export function formatCLP(value: number): string {
	return formatearMoneda(value, "CLP");
}

/** Monto abreviado para ejes y cifras grandes: "$2,6 M", "$850 mil", "$900". */
export function formatCompactCLP(value: number): string {
	const abs = Math.abs(value);
	const fmt = (n: number, digits: number) =>
		n.toLocaleString("es-CL", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
	if (abs >= 1_000_000) return `$${fmt(value / 1_000_000, abs >= 10_000_000 ? 0 : 1)} M`;
	if (abs >= 1_000) return `$${fmt(value / 1_000, 0)} mil`;
	return `$${fmt(value, 0)}`;
}
