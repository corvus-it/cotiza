import { Alert } from "antd";

/** Aviso cuando no hay usuario actual o no tiene empresa (los presupuestos son de la empresa). */
export function AccessAlert({ reason }: { reason: "no-user" | "no-company" }) {
	return reason === "no-user" ? (
		<Alert
			type="warning"
			showIcon
			title="No hay usuario actual"
			description="Tu sesión terminó. Vuelve a ingresar."
		/>
	) : (
		<Alert
			type="warning"
			showIcon
			title="Tu usuario no tiene empresa asignada"
			description="Los datos pertenecen a la empresa de cada usuario. Pide a un administrador que te agregue a la suya."
		/>
	);
}
