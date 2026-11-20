"use client";

import { Tag, Tooltip } from "antd";
import { MailCheckIcon } from "lucide-react";
import type { BudgetLastSent } from "@/lib/budgets/queries";

/** Marca de «Enviado» con la fecha y el destinatario del último envío. */
export function SentTag({ lastSent }: { lastSent: BudgetLastSent }) {
	if (!lastSent) return null;
	return (
		<Tooltip title={`Último envío: ${lastSent.at} a ${lastSent.to}`}>
			<Tag color="green" icon={<MailCheckIcon size={12} aria-hidden style={{ marginRight: 4 }} />}>
				Enviado
			</Tag>
		</Tooltip>
	);
}
