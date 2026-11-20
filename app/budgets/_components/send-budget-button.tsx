"use client";

import { Alert, App, Button, Form, Input, Modal, Tooltip } from "antd";
import Link from "next/link";
import { MailIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { sendBudgetEmail } from "@/lib/actions/email";
import type { BudgetLastSent } from "@/lib/budgets/queries";

type Values = { to: string; message?: string };

type SendBudgetButtonProps = {
	code: string;
	clientEmail: string | null;
	/** La empresa no tiene correo: no se puede enviar (las respuestas no tendrían destino). */
	companyEmailMissing: boolean;
	/** Solo un administrador puede agregar el correo en «Mi empresa». */
	isAdmin: boolean;
	/** Último envío exitoso: se avisa en el modal para evitar duplicados. */
	lastSent?: BudgetLastSent;
	/** Solo ícono (para la columna de acciones del listado). */
	compact?: boolean;
};

/** Envía el presupuesto con su PDF al correo del cliente (editable). */
export function SendBudgetButton({
	code,
	clientEmail,
	companyEmailMissing,
	isAdmin,
	lastSent = null,
	compact = false,
}: SendBudgetButtonProps) {
	const { message } = App.useApp();
	const [form] = Form.useForm<Values>();
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();
	// Un id por instancia: en el listado hay un modal por fila.
	const formId = `send-budget-${useId()}`;

	function onFinish(values: Values) {
		startTransition(async () => {
			const result = await sendBudgetEmail(code, values);
			if (result.ok) {
				message.success(`Presupuesto enviado a ${result.to}.`);
				setOpen(false);
			} else {
				message.error(result.message);
			}
		});
	}

	if (companyEmailMissing) {
		return (
			<Tooltip
				title={
					isAdmin ? (
						<>
							Agrega el correo de la empresa en <Link href="/company">Mi empresa</Link> para enviar
							presupuestos.
						</>
					) : (
						"La empresa no tiene correo. Pide a un administrador que lo agregue en Mi empresa."
					)
				}
			>
				<Button icon={<MailIcon size={16} aria-hidden />} aria-label={`Enviar ${code} por correo`} disabled>
					{!compact && "Enviar por correo"}
				</Button>
			</Tooltip>
		);
	}

	return (
		<>
			{compact ? (
				<Tooltip title={lastSent ? "Reenviar por correo" : "Enviar por correo"}>
					<Button
						icon={<MailIcon size={16} aria-hidden />}
						aria-label={`Enviar ${code} por correo`}
						onClick={() => setOpen(true)}
					/>
				</Tooltip>
			) : (
				<Button icon={<MailIcon size={16} aria-hidden />} onClick={() => setOpen(true)}>
					{lastSent ? "Reenviar por correo" : "Enviar por correo"}
				</Button>
			)}
			<Modal
				title={`Enviar presupuesto ${code}`}
				open={open}
				onCancel={() => !pending && setOpen(false)}
				okText="Enviar"
				cancelText="Cancelar"
				okButtonProps={{ htmlType: "submit", form: formId, loading: pending }}
				cancelButtonProps={{ disabled: pending }}
				destroyOnHidden
			>
				{lastSent && (
					<Alert
						type="info"
						showIcon
						style={{ marginBottom: 16 }}
						title={`Ya se envió el ${lastSent.at} a ${lastSent.to}.`}
					/>
				)}
				<Form
					id={formId}
					form={form}
					layout="vertical"
					initialValues={{ to: clientEmail ?? "" }}
					onFinish={onFinish}
					disabled={pending}
					preserve={false}
				>
					<Form.Item
						label="Correo del destinatario"
						name="to"
						rules={[
							{ required: true, message: "Ingresa un correo." },
							{ type: "email", message: "Correo no válido." },
						]}
					>
						<Input type="email" autoComplete="email" maxLength={150} />
					</Form.Item>
					<Form.Item
						label="Mensaje (opcional)"
						name="message"
						extra="Si lo dejas vacío se usa un texto estándar. El PDF va adjunto."
					>
						<Input.TextArea rows={4} maxLength={2000} showCount />
					</Form.Item>
				</Form>
			</Modal>
		</>
	);
}
