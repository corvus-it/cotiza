import { formatearRut, validarRut } from "cotizacion-cl";
import { parseId } from "@/lib/db/parse-id";

/** Código del rol que administra la empresa (datos y trabajadores). */
export const ADMIN_ROLE = "admin";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s()-]{5,29}$/;

function text(value: unknown): string {
	return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** Primer error de un texto opcional que supera `max` caracteres. */
function tooLong(value: string, max: number): string | undefined {
	return value.length > max ? `Máximo ${max} caracteres.` : undefined;
}

function isHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Empresa
// ---------------------------------------------------------------------------

export type CompanyInput = {
	rut: string;
	name: string;
	businessActivity?: string | null;
	address?: string | null;
	commune?: string | null;
	city?: string | null;
	email?: string | null;
	phone?: string | null;
	website?: string | null;
	logo?: string | null;
};

export type CompanyData = {
	rut: string;
	name: string;
	businessActivity: string | null;
	address: string | null;
	commune: string | null;
	city: string | null;
	email: string | null;
	phone: string | null;
	website: string | null;
	logo: string | null;
};

export type CompanyFieldErrors = Partial<Record<keyof CompanyInput, string>>;

export type CompanyActionState =
	| { ok: true }
	| { ok: false; message?: string; fieldErrors?: CompanyFieldErrors };

export function parseCompanyInput(
	input: unknown,
): { ok: true; data: CompanyData } | { ok: false; fieldErrors: CompanyFieldErrors } {
	const raw = (input ?? {}) as Record<string, unknown>;
	const rut = text(raw.rut);
	const name = text(raw.name);
	const businessActivity = text(raw.businessActivity);
	const address = text(raw.address);
	const commune = text(raw.commune);
	const city = text(raw.city);
	const email = text(raw.email).toLowerCase();
	const phone = text(raw.phone);
	const website = text(raw.website);
	const logo = text(raw.logo);

	const errors: CompanyFieldErrors = {};

	if (!rut) errors.rut = "El RUT es obligatorio.";
	else if (!validarRut(rut)) errors.rut = "RUT inválido.";

	if (!name) errors.name = "La razón social es obligatoria.";
	else errors.name = tooLong(name, 150);

	errors.businessActivity = tooLong(businessActivity, 255);
	errors.address = tooLong(address, 255);
	errors.commune = tooLong(commune, 80);
	errors.city = tooLong(city, 80);

	if (email && (email.length > 150 || !EMAIL_RE.test(email))) errors.email = "Correo inválido.";
	if (phone && !PHONE_RE.test(phone)) errors.phone = "Teléfono inválido.";
	if (website && (website.length > 255 || !isHttpUrl(website)))
		errors.website = "URL inválida (debe empezar con http:// o https://).";
	if (logo && (logo.length > 500 || !isHttpUrl(logo)))
		errors.logo = "URL inválida (debe empezar con http:// o https://).";

	for (const key of Object.keys(errors) as (keyof CompanyFieldErrors)[]) {
		if (!errors[key]) delete errors[key];
	}
	if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

	return {
		ok: true,
		data: {
			rut: formatearRut(rut, { puntos: false }),
			name,
			businessActivity: businessActivity || null,
			address: address || null,
			commune: commune || null,
			city: city || null,
			email: email || null,
			phone: phone || null,
			website: website || null,
			logo: logo || null,
		},
	};
}

// ---------------------------------------------------------------------------
// Trabajadores (usuarios de la empresa)
// ---------------------------------------------------------------------------

export type WorkerInput = {
	name: string;
	email: string;
	roleId: number;
	/** Obligatoria al crear; al editar, vacía = no cambiarla. */
	password?: string | null;
};

export type WorkerData = { name: string; email: string; roleId: number };

export type WorkerFieldErrors = Partial<Record<keyof WorkerInput, string>>;

export type WorkerActionState =
	| { ok: true }
	| { ok: false; message?: string; fieldErrors?: WorkerFieldErrors };

export function parseWorkerInput(
	input: unknown,
	{ passwordRequired }: { passwordRequired: boolean },
):
	| { ok: true; data: WorkerData; password: string | null }
	| { ok: false; fieldErrors: WorkerFieldErrors } {
	const raw = (input ?? {}) as Record<string, unknown>;
	const name = text(raw.name);
	const email = text(raw.email).toLowerCase();
	const roleId = parseId(raw.roleId);
	// La contraseña no se recorta: los espacios son parte de ella.
	const password = typeof raw.password === "string" ? raw.password : "";

	const errors: WorkerFieldErrors = {};

	if (!name) errors.name = "El nombre es obligatorio.";
	else if (name.length > 150) errors.name = "Máximo 150 caracteres.";

	if (!email) errors.email = "El correo es obligatorio.";
	else if (email.length > 150 || !EMAIL_RE.test(email)) errors.email = "Correo inválido.";

	if (roleId === null) errors.roleId = "Selecciona un rol.";

	if (!password) {
		if (passwordRequired) errors.password = "La contraseña es obligatoria.";
	} else if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
		errors.password = `Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`;
	}

	if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
	return { ok: true, data: { name, email, roleId: roleId! }, password: password || null };
}
