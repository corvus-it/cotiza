"use client";

import { App, Button, Popconfirm, Tooltip } from "antd";
import { CircleCheckIcon, Undo2Icon } from "lucide-react";
import { useTransition } from "react";
import { acceptBudget, unacceptBudget } from "@/lib/actions/budgets";

type AcceptButtonProps = {
	code: string;
	/** Ya aceptado: el botón revierte la aceptación. */
	accepted: boolean;
	/** Solo ícono (tabla). */
	compact?: boolean;
};

/** Marca el presupuesto como aceptado por el cliente, o revierte la marca. */
export function AcceptButton({ code, accepted, compact }: AcceptButtonProps) {
	const { message } = App.useApp();
	const [pending, startTransition] = useTransition();

	function onConfirm() {
		startTransition(async () => {
			const result = accepted ? await unacceptBudget(code) : await acceptBudget(code);
			if (result.ok)
				message.success(accepted ? `Se revirtió la aceptación de ${code}.` : `Presupuesto ${code} aceptado.`);
			else message.error(result.message ?? "No se pudo actualizar el presupuesto.");
		});
	}

	const label = accepted ? "Revertir aceptación" : "Marcar como aceptado";
	const icon = accepted ? <Undo2Icon size={16} aria-hidden /> : <CircleCheckIcon size={16} aria-hidden />;
	const button = compact ? (
		<Button icon={icon} loading={pending} aria-label={`${label}: ${code}`} />
	) : (
		<Button icon={icon} loading={pending} type={accepted ? "default" : "primary"} ghost={!accepted}>
			{label}
		</Button>
	);

	return (
		<Popconfirm
			title={label}
			description={
				accepted
					? `¿Revertir la aceptación de ${code}? Volverá a quedar vigente o vencido y se podrá modificar.`
					: `¿El cliente aceptó el presupuesto ${code}? Ya no se podrá modificar (sí anular).`
			}
			okText={accepted ? "Revertir" : "Aceptar"}
			cancelText="Cancelar"
			onConfirm={onConfirm}
		>
			{compact ? <Tooltip title={label}>{button}</Tooltip> : button}
		</Popconfirm>
	);
}
