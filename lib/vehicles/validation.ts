import { parseIdList } from "@/lib/db/parse-id";

/** Tipos de combustible sugeridos en la UI (la columna admite texto libre). */
export const FUEL_TYPES = ["Bencina", "Diésel", "Híbrido", "Eléctrico", "Gas", "Otro"] as const;

/** Datos del formulario de vehículo (lo que envía la UI). */
export type VehicleInput = {
	plate: string;
	brand: string;
	model: string;
	year?: number | null;
	motor?: string | null;
	fuelType?: string | null;
	mileage?: number | null;
	/** Clientes dueños del vehículo (0..N). */
	clientIds?: number[];
};

/** Datos validados y normalizados, listos para la BD. */
export type VehicleData = {
	plate: string;
	brand: string;
	model: string;
	year: number | null;
	motor: string | null;
	fuelType: string | null;
	mileage: number | null;
};

export type VehicleFieldErrors = Partial<Record<keyof VehicleInput, string>>;

export type VehicleActionState =
	| { ok: true }
	| { ok: false; message?: string; fieldErrors?: VehicleFieldErrors };

/** Resultado de crear un vehículo sin redirigir: devuelve la opción creada con sus dueños. */
export type InlineVehicleState =
	| {
			ok: true;
			vehicle: { id: number; plate: string; brand: string; model: string; ownerIds: number[] };
	  }
	| Extract<VehicleActionState, { ok: false }>;

export const YEAR_MIN = 1900;
/** Año máximo admitido: el siguiente al actual (modelos del año próximo). */
export function maxVehicleYear(): number {
	return new Date().getFullYear() + 1;
}

/** Patente normalizada: mayúsculas, sin espacios, puntos ni guiones (p. ej. "ABCD12"). */
export function normalizePlate(plate: string): string {
	return plate.toUpperCase().replace(/[\s.\-·]/g, "");
}

const PLATE_RE = /^[A-Z0-9]{4,10}$/;

function text(value: unknown): string {
	return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** `undefined`/`null`/"" → `null`; número entero → número; otro → `NaN`. */
function optionalInt(value: unknown): number | null {
	if (value === undefined || value === null || value === "") return null;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isInteger(n) ? n : Number.NaN;
}

/** Valida y normaliza. Se usa en el servidor (la UI repite reglas básicas). */
export function parseVehicleInput(
	input: unknown,
):
	| { ok: true; data: VehicleData; clientIds: number[] }
	| { ok: false; fieldErrors: VehicleFieldErrors } {
	const raw = (input ?? {}) as Record<string, unknown>;
	const plate = normalizePlate(text(raw.plate));
	const brand = text(raw.brand);
	const model = text(raw.model);
	const motor = text(raw.motor);
	const fuelType = text(raw.fuelType);
	const year = optionalInt(raw.year);
	const mileage = optionalInt(raw.mileage);
	const clientIds = parseIdList(raw.clientIds);

	const fieldErrors: VehicleFieldErrors = {};

	if (!plate) fieldErrors.plate = "La patente es obligatoria.";
	else if (!PLATE_RE.test(plate)) fieldErrors.plate = "Patente inválida.";

	if (!brand) fieldErrors.brand = "La marca es obligatoria.";
	else if (brand.length > 80) fieldErrors.brand = "Máximo 80 caracteres.";

	if (!model) fieldErrors.model = "El modelo es obligatorio.";
	else if (model.length > 80) fieldErrors.model = "Máximo 80 caracteres.";

	if (year !== null && (Number.isNaN(year) || year < YEAR_MIN || year > maxVehicleYear()))
		fieldErrors.year = `Año entre ${YEAR_MIN} y ${maxVehicleYear()}.`;

	if (motor.length > 80) fieldErrors.motor = "Máximo 80 caracteres.";
	if (fuelType.length > 30) fieldErrors.fuelType = "Máximo 30 caracteres.";

	if (mileage !== null && (Number.isNaN(mileage) || mileage < 0 || mileage > 2_147_483_647))
		fieldErrors.mileage = "Kilometraje inválido.";

	if (clientIds === null) fieldErrors.clientIds = "Clientes inválidos.";

	if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

	return {
		ok: true,
		clientIds: clientIds!,
		data: {
			plate,
			brand,
			model,
			year,
			motor: motor || null,
			fuelType: fuelType || null,
			mileage,
		},
	};
}
