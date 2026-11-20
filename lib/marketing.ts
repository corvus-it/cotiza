/*
 * Contenido comercial de la página de inicio pública: planes y contacto.
 * Editar aquí precios y beneficios; la página solo los dibuja.
 */

export const IVA_RATE = 0.19;

export type Plan = {
	id: "taller" | "pro";
	name: string;
	/** Precio mensual neto en CLP (se muestra "+ IVA"). */
	price: number;
	pitch: string;
	features: string[];
	highlighted?: boolean;
};

export const PLANS: Plan[] = [
	{
		id: "taller",
		name: "Taller",
		price: 15_000,
		pitch: "Para el taller que quiere ordenar sus presupuestos y mandarlos por correo.",
		features: [
			"Presupuestos, clientes y vehículos ilimitados",
			"Envío de presupuestos por correo",
			"Hasta 3 usuarios",
			"Panel de inicio y aviso de presupuestos por vencer",
			"Soporte por correo",
		],
	},
	{
		id: "pro",
		name: "Taller Pro",
		price: 30_000,
		pitch: "Para el taller que hace seguimiento y quiere cerrar más trabajos.",
		highlighted: true,
		features: [
			"Todo lo del plan Taller",
			"Envío por WhatsApp y por correo",
			"Recordatorio automático al cliente antes de que venza",
			"Aprobación en línea: el cliente acepta desde el enlace",
			"Usuarios ilimitados",
			"Exportación a Excel",
			"Soporte prioritario por WhatsApp",
		],
	},
];

/** Diferencias entre planes, para la tabla comparativa. */
export const PLAN_COMPARISON: { feature: string; taller: boolean | string; pro: boolean | string }[] = [
	{ feature: "Presupuestos con IVA, clientes y vehículos", taller: "Ilimitados", pro: "Ilimitados" },
	{ feature: "Panel de inicio y vencimientos", taller: true, pro: true },
	{ feature: "Envío por correo", taller: true, pro: true },
	{ feature: "Envío por WhatsApp", taller: false, pro: true },
	{ feature: "Recordatorio automático antes del vencimiento", taller: false, pro: true },
	{ feature: "Aprobación en línea del cliente", taller: false, pro: true },
	{ feature: "Usuarios", taller: "Hasta 3", pro: "Ilimitados" },
	{ feature: "Exportación a Excel", taller: false, pro: true },
	{ feature: "Soporte", taller: "Correo", pro: "WhatsApp prioritario" },
];

export const withIva = (net: number) => Math.round(net * (1 + IVA_RATE));

/**
 * Contacto comercial (variables de entorno del servidor):
 *   CONTACT_WHATSAPP  número en formato internacional sin "+", p. ej. 56912345678
 *   CONTACT_EMAIL     correo de ventas
 */
export type Contact = { whatsapp: string | null; email: string | null };

export function getContact(): Contact {
	const whatsapp = process.env.CONTACT_WHATSAPP?.replace(/\D/g, "") || null;
	const email = process.env.CONTACT_EMAIL?.trim() || null;
	return { whatsapp, email };
}

/** Enlace para contratar un plan: WhatsApp si hay número, si no correo, si no el login. */
export function contactHref(contact: Contact, message: string): string {
	if (contact.whatsapp) return `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`;
	if (contact.email)
		return `mailto:${contact.email}?subject=${encodeURIComponent("CorvusGarage")}&body=${encodeURIComponent(message)}`;
	return "/login";
}
