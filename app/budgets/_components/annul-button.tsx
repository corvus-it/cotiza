"use client";

import { App, Button, Popconfirm } from "antd";
import { BanIcon } from "lucide-react";
import { useTransition } from "react";
import { annulBudget } from "@/lib/actions/budgets";

export function AnnulButton({ code }: { code: string }) {
	const { message } = App.useApp();
	const [pending, startTransition] = useTransition();

	function onConfirm() {
		startTransition(async () => {
			const result = await annulBudget(code);
			if (result.ok) message.success(`Presupuesto ${code} anulado.`);
			else message.error(result.message ?? "No se pudo anular el presupuesto.");
		});
	}

	return (
		<Popconfirm
			title="Anular presupuesto"
			description={`¿Anular el presupuesto ${code}? No se podrá modificar.`}
			okText="Anular"
			cancelText="Cancelar"
			okButtonProps={{ danger: true }}
			onConfirm={onConfirm}
		>
			<Button danger icon={<BanIcon size={16} />} loading={pending}>
				Anular
			</Button>
		</Popconfirm>
	);
}
