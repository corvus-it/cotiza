"use client";

import { Tag } from "antd";
import { PageHeader } from "@/app/components/page-layout";
import { BUDGET_STATUSES, type BudgetStatus } from "@/lib/budgets/status";
import { formatDate } from "@/lib/format";

type BudgetHeaderProps = {
	code: string;
	budgetNumber: number;
	status: BudgetStatus;
	userName: string;
	expiresOn: string;
};

/** Cabecera del detalle: código, estado y datos de emisión. */
export function BudgetHeader({ code, budgetNumber, status, userName, expiresOn }: BudgetHeaderProps) {
	const { label, color } = BUDGET_STATUSES[status];
	return (
		<PageHeader
			title={`Presupuesto ${code}`}
			meta={<Tag color={color}>{label}</Tag>}
			description={`N.º ${budgetNumber}, creado por ${userName}. ${
				status === "vencido" ? "Venció" : "Vence"
			} el ${formatDate(expiresOn)}.`}
			back={{ href: "/budgets", label: "Presupuestos" }}
		/>
	);
}
