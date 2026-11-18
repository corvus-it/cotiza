import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./current-user";

export type Authorized = { user: CurrentUser; companyId: number };

/**
 * Punto único de autorización: lo llaman las Server Actions (invocables por
 * POST directo) y las consultas de datos. Sin sesión válida → `/login`.
 *
 * Devuelve la empresa del usuario: TODA lectura o escritura de clientes,
 * vehículos y presupuestos se limita a ese `companyId`, que nunca viene del
 * navegador.
 */
export async function authorize(): Promise<Authorized> {
	const user = await getCurrentUser();
	if (!user) redirect("/login");
	// El login exige empresa; esto cubre a un usuario al que se la quitaron después.
	if (user.companyId === null) redirect("/login?error=sin-empresa");
	return { user, companyId: user.companyId };
}
