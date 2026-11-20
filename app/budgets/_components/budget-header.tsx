"use client";

import { Button, Flex, Tag } from "antd";
import { FileDownIcon } from "lucide-react";
import { PageHeader } from "@/app/components/page-layout";
import { budgetPdfHref } from "@/lib/budgets/links";
import type { BudgetLastSent } from "@/lib/budgets/queries";
import { BUDGET_STATUSES, type BudgetStatus } from "@/lib/budgets/status";
import { formatDate } from "@/lib/format";
import { AcceptButton } from "./accept-button";
import { SendBudgetButton } from "./send-budget-button";
import { SentTag } from "./sent-tag";

type BudgetHeaderProps = {
	code: string;
	budgetNumber: number;
	status: BudgetStatus;
	userName: string;
	expiresOn: string;
	/** Fecha de aceptación (hora de Chile), si está aceptado. */
	acceptedAt: string | null;
	/** Correo del cliente, para prellenar el envío. */
	clientEmail: string | null;
	/** Sin correo de la empresa no se puede enviar por correo. */
	companyEmailMissing: boolean;
	isAdmin: boolean;
	lastSent: BudgetLastSent;
};

/** Cabecera del detalle: código, estado y datos de emisión. */
export function BudgetHeader({
	code,
	budgetNumber,
	status,
	userName,
	expiresOn,
	acceptedAt,
	clientEmail,
	companyEmailMissing,
	isAdmin,
	lastSent,
}: BudgetHeaderProps) {
	const { label, color } = BUDGET_STATUSES[status];
	return (
		<PageHeader
			title={`Presupuesto ${code}`}
			meta={
				<>
					<Tag color={color}>{label}</Tag>
					<SentTag lastSent={lastSent} />
				</>
			}
			description={`N.º ${budgetNumber}, creado por ${userName}. ${
				status === "aceptado" && acceptedAt
					? `Aceptado el ${acceptedAt}.`
					: `${status === "vencido" ? "Venció" : "Vence"} el ${formatDate(expiresOn)}.`
			}`}
			back={{ href: "/budgets", label: "Presupuestos" }}
			actions={
				<Flex gap="small" wrap>
					<Button
						href={budgetPdfHref(code)}
						target="_blank"
						rel="noopener"
						icon={<FileDownIcon size={16} aria-hidden />}
					>
						Ver PDF
					</Button>
					{status !== "anulado" && <AcceptButton code={code} accepted={status === "aceptado"} />}
					{status !== "anulado" && (
						<SendBudgetButton
							code={code}
							clientEmail={clientEmail}
							companyEmailMissing={companyEmailMissing}
							isAdmin={isAdmin}
							lastSent={lastSent}
						/>
					)}
				</Flex>
			}
		/>
	);
}
