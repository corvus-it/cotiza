import { formatearRut, validarRut } from "cotizacion-cl";
import { parseIdList } from "@/lib/db/parse-id";

/** Datos del formulario de cliente (lo que envía la UI). */
export type ClientInput = {
	rut: string;
	name: string;
	email?: string | null;
	phone?: string | null;
	/** Vehículos del cliente (0..N). */
	vehicleIds?: number[];
};

/** Datos ya validados y normalizados, listos para la BD. */
export type ClientData = {
	rut: string;
	name: string;
	email: string | null;
	phone: string | null;
};

export type ClientFieldErrors = Partial<Record<keyof ClientInput, string>>;

export type ClientActionState =
	| { ok: true }
	| { ok: false; message?: string; fieldErrors?: ClientFieldErrors };

/** Resultado de crear un cliente sin redirigir: devuelve la opción creada. */
export type InlineClientState =
	| { ok: true; client: { id: number; name: string; rut: string } }
	| Extract<ClientActionState, { ok: false }>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s()-]{5,29}$/;

function clean(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

/** Valida y normaliza. Se usa en el servidor (la UI repite reglas básicas). */
export function parseClientInput(
	input: unknown,
): { ok: true; data: ClientData; vehicleIds: number[] } | { ok: false; fieldErrors: ClientFieldErrors } {
	const raw = (input ?? {}) as Record<string, unknown>;
	const rut = clean(raw.rut);
	const name = clean(raw.name).replace(/\s+/g, " ");
	const email = clean(raw.email).toLowerCase();
	const phone = clean(raw.phone);
	const vehicleIds = parseIdList(raw.vehicleIds);

	const fieldErrors: ClientFieldErrors = {};

	if (!rut) fieldErrors.rut = "El RUT es obligatorio.";
	else if (!validarRut(rut)) fieldErrors.rut = "RUT inválido.";

	if (!name) fieldErrors.name = "El nombre es obligatorio.";
	else if (name.length > 150) fieldErrors.name = "Máximo 150 caracteres.";

	if (email && (email.length > 150 || !EMAIL_RE.test(email)))
		fieldErrors.email = "Correo inválido.";

	if (phone && !PHONE_RE.test(phone)) fieldErrors.phone = "Teléfono inválido.";

	if (vehicleIds === null) fieldErrors.vehicleIds = "Vehículos inválidos.";

	if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

	return {
		ok: true,
		vehicleIds: vehicleIds!,
		data: {
			rut: formatearRut(rut, { puntos: false }),
			name,
			email: email || null,
			phone: phone || null,
		},
	};
}
