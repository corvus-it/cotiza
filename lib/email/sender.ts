import "server-only";
import type { ReactElement } from "react";
import { render, toPlainText } from "react-email";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { emailLogs, type Company } from "@/lib/db/schemas";

/*
 * Envío de correos en nombre de cada empresa.
 *
 * Modo actual ("plataforma"): todos los correos salen desde la dirección
 * verificada de la plataforma (`EMAIL_FROM`), con el NOMBRE de la empresa como
 * remitente visible y `Reply-To` apuntando al correo de la empresa:
 *
 *   From:     "Taller Pérez" <cotizaciones@cotiza.app>
 *   Reply-To: contacto@tallerperez.cl
 *
 * Así cada empresa "envía sus propios correos" sin configurar DNS. Más
 * adelante `senderFor` puede elegir un dominio propio verificado de la empresa
 * (Resend Domains API) sin tocar a quienes llaman a `sendCompanyEmail`.
 */

export type EmailAttachment = { filename: string; content: Buffer | Uint8Array; contentType?: string };

export type CompanyEmail = {
	company: Company;
	to: string;
	subject: string;
	/** Plantilla de React Email; se renderiza a HTML y texto plano. */
	template: ReactElement;
	attachments?: EmailAttachment[];
	/** Etiquetas para filtrar en el panel de Resend (solo [A-Za-z0-9_-]). */
	tags?: Record<string, string>;
	/** Evita duplicados si el usuario reintenta (Resend la recuerda 24 h). */
	idempotencyKey?: string;
	/** Datos para `email_logs`: qué tipo de correo es, quién lo envía y de qué presupuesto. */
	log: { type: string; userId?: number | null; budgetId?: number | null };
};

export type SendResult =
	| { ok: true; id: string }
	| { ok: false; reason: "not-configured" | "no-company-email" | "rejected" | "failed"; message: string };

let client: Resend | null = null;

function resend(): Resend | null {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) return null;
	client ??= new Resend(apiKey);
	return client;
}

/**
 * Nombre visible seguro para la cabecera `From`: sin saltos de línea
 * (inyección de cabeceras) ni comillas o `<>` que rompan el formato.
 */
function displayName(name: string): string {
	const clean = name.replace(/[\r\n"<>\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70);
	return clean || "Cotiza";
}

/** Correo de la empresa (destino de las respuestas), o `null` si no lo tiene. */
export function companyReplyTo(company: Pick<Company, "email">): string | null {
	return company.email?.trim() || null;
}

/** Remitente y respuesta para la empresa. Punto único para sumar dominios propios. */
function senderFor(company: Company, platformFrom: string, replyTo: string): { from: string; replyTo: string } {
	return { from: `"${displayName(company.name)}" <${platformFrom}>`, replyTo };
}

/** Valores de etiqueta aceptados por Resend: ASCII, dígitos, `_` y `-`. */
function tagValue(value: string): string {
	return value.replace(/[^\w-]/g, "_").slice(0, 256);
}

/**
 * Envía el correo y deja registro en `email_logs` (exitoso o fallido). Si el
 * registro falla, el resultado del envío no cambia: el correo ya salió.
 */
export async function sendCompanyEmail(email: CompanyEmail): Promise<SendResult> {
	const result = await deliver(email);
	await logEmail(email, result);
	return result;
}

async function logEmail(email: CompanyEmail, result: SendResult): Promise<void> {
	try {
		await db.insert(emailLogs).values({
			companyId: email.company.id,
			userId: email.log.userId ?? null,
			budgetId: email.log.budgetId ?? null,
			type: email.log.type.slice(0, 30),
			toEmail: email.to.slice(0, 150),
			subject: email.subject.slice(0, 255),
			status: result.ok ? "sent" : "failed",
			providerId: result.ok ? result.id : null,
			errorCode: result.ok ? null : result.reason,
			error: result.ok ? null : result.message,
		});
	} catch (error) {
		console.error("sendCompanyEmail: no se pudo registrar en email_logs", error);
	}
}

async function deliver(email: CompanyEmail): Promise<SendResult> {
	const api = resend();
	const platformFrom = process.env.EMAIL_FROM?.trim();
	if (!api || !platformFrom) {
		return {
			ok: false,
			reason: "not-configured",
			message: "El envío de correos no está configurado (faltan RESEND_API_KEY o EMAIL_FROM).",
		};
	}

	// Obligatorio: sin él, las respuestas del cliente llegarían a la plataforma.
	const companyEmail = companyReplyTo(email.company);
	if (!companyEmail) {
		return {
			ok: false,
			reason: "no-company-email",
			message: "La empresa no tiene correo configurado para recibir las respuestas.",
		};
	}

	const html = await render(email.template);
	const { from, replyTo } = senderFor(email.company, platformFrom, companyEmail);

	try {
		const { data, error } = await api.emails.send(
			{
				from,
				replyTo,
				to: email.to,
				subject: email.subject,
				html,
				text: toPlainText(html),
				attachments: email.attachments?.map((a) => ({
					filename: a.filename,
					content: Buffer.from(a.content),
					contentType: a.contentType,
				})),
				tags: [
					{ name: "company_id", value: String(email.company.id) },
					{ name: "type", value: tagValue(email.log.type) },
					...Object.entries(email.tags ?? {}).map(([name, value]) => ({
						name: tagValue(name),
						value: tagValue(value),
					})),
				],
			},
			email.idempotencyKey ? { idempotencyKey: email.idempotencyKey } : undefined,
		);
		if (error || !data) {
			console.error("sendCompanyEmail: Resend rechazó el envío", error);
			return { ok: false, reason: "rejected", message: error?.message ?? "El proveedor rechazó el correo." };
		}
		return { ok: true, id: data.id };
	} catch (error) {
		console.error("sendCompanyEmail", error);
		return { ok: false, reason: "failed", message: "No se pudo conectar con el servicio de correo." };
	}
}
