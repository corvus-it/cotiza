"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { createElement } from "react";
import { renderBudgetPdf } from "@/lib/budgets/pdf";
import { getBudgetAccess, getCompanyBudget, ofCompany } from "@/lib/budgets/queries";
import { db } from "@/lib/db";
import { budgets } from "@/lib/db/schemas";
import { ADMIN_ROLE } from "@/lib/company/validation";
import { companyReplyTo, sendCompanyEmail } from "@/lib/email/sender";
import { BudgetEmail } from "@/lib/email/templates/budget-email";
import { formatCLP, formatDate } from "@/lib/format";

/** Aviso cuando la empresa no tiene correo: solo un administrador puede agregarlo. */
function missingCompanyEmailMessage(isAdmin: boolean): string {
	return isAdmin
		? "Agrega el correo de la empresa en «Mi empresa» para poder enviar presupuestos."
		: "La empresa no tiene correo configurado. Pide a un administrador que lo agregue en «Mi empresa».";
}

export type SendBudgetEmailState = { ok: true; to: string } | { ok: false; message: string };

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]+$/;
const MAX_MESSAGE = 2000;

/**
 * Envía el presupuesto (PDF adjunto) por correo en nombre de la empresa del
 * usuario. Como toda Server Action, es invocable por POST directo: la empresa
 * sale de la sesión y el presupuesto se busca dentro de ella.
 */
export async function sendBudgetEmail(
	rawCode: unknown,
	input: { to?: unknown; message?: unknown },
): Promise<SendBudgetEmailState> {
	const access = await getBudgetAccess();
	if (!access.ok) {
		return {
			ok: false,
			message:
				access.reason === "no-user"
					? "Tu sesión terminó. Vuelve a ingresar."
					: "Tu usuario no tiene una empresa asignada.",
		};
	}
	if (typeof rawCode !== "string" || !rawCode) return { ok: false, message: "Presupuesto inválido." };
	if (!companyReplyTo(access.company)) {
		return { ok: false, message: missingCompanyEmailMessage(access.user.roleCode === ADMIN_ROLE) };
	}

	const to = typeof input.to === "string" ? input.to.trim() : "";
	if (!EMAIL_RE.test(to) || to.length > 150) return { ok: false, message: "Ingresa un correo válido." };
	const message = typeof input.message === "string" ? input.message.trim().slice(0, MAX_MESSAGE) : "";

	const [budget, [budgetRow]] = await Promise.all([
		getCompanyBudget(access.company.id, rawCode),
		// `BudgetFull` no expone el id interno; se necesita para `email_logs`.
		db
			.select({ id: budgets.id })
			.from(budgets)
			.where(and(eq(budgets.code, rawCode), ofCompany(access.company.id)))
			.limit(1),
	]);
	if (!budget || !budgetRow) return { ok: false, message: "Presupuesto no encontrado." };
	if (budget.status === "anulado") return { ok: false, message: "No se puede enviar un presupuesto anulado." };

	const { company } = access;
	let pdf: Buffer;
	try {
		pdf = await renderBudgetPdf(budget, company);
	} catch (error) {
		console.error("sendBudgetEmail: PDF", error);
		return { ok: false, message: "No se pudo generar el PDF del presupuesto." };
	}

	const result = await sendCompanyEmail({
		company,
		to,
		subject: `Presupuesto ${budget.code} · ${company.name}`,
		template: createElement(BudgetEmail, {
			companyName: company.name,
			companyLogo: company.logo,
			companyEmail: company.email,
			companyPhone: company.phone,
			companyWebsite: company.website,
			clientName: budget.clientName,
			code: budget.code,
			total: formatCLP(budget.totalAmount),
			expiresOn: formatDate(budget.expiresOn),
			message: message || null,
		}),
		attachments: [
			{
				filename: `presupuesto-${budget.code.replace(/[^\w.-]/g, "_")}.pdf`,
				content: pdf,
				contentType: "application/pdf",
			},
		],
		tags: { budget_code: budget.code },
		log: { type: "budget", userId: access.user.id, budgetId: budgetRow.id },
	});

	if (!result.ok) {
		return {
			ok: false,
			message:
				result.reason === "not-configured"
					? "El envío de correos aún no está configurado."
					: result.reason === "no-company-email"
						? missingCompanyEmailMessage(access.user.roleCode === ADMIN_ROLE)
						: "No se pudo enviar el correo. Inténtalo de nuevo.",
		};
	}
	// La marca de «Enviado» (listado y detalle) sale de `email_logs`.
	refresh();
	return { ok: true, to };
}
