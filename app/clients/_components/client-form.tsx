"use client";

import { Alert, Button, Card, Flex, Form, Input } from "antd";
import { formatearRut, validarRut } from "cotizacion-cl";
import Link from "next/link";
import { useState, useTransition } from "react";
import type {
	ClientActionState,
	ClientFieldErrors,
	ClientInput,
} from "@/lib/clients/validation";

type ClientFormProps = {
	title: string;
	submitLabel: string;
	initialValues?: ClientInput;
	action: (values: ClientInput) => Promise<ClientActionState>;
};

export function ClientForm({ title, submitLabel, initialValues, action }: ClientFormProps) {
	const [form] = Form.useForm<ClientInput>();
	const [pending, startTransition] = useTransition();
	const [message, setMessage] = useState<string>();

	function onFinish(values: ClientInput) {
		setMessage(undefined);
		startTransition(async () => {
			const result = await action(values);
			if (result.ok) return;
			setMessage(result.message);
			const errors: ClientFieldErrors = result.fieldErrors ?? {};
			form.setFields(
				(Object.keys(errors) as (keyof ClientInput)[]).map((name) => ({
					name,
					errors: [errors[name]!],
				})),
			);
		});
	}

	function formatRutOnBlur() {
		const rut = form.getFieldValue("rut");
		if (typeof rut === "string" && validarRut(rut)) {
			form.setFieldValue("rut", formatearRut(rut));
		}
	}

	return (
		<Card title={title} style={{ maxWidth: 640 }}>
			{message && (
				<Alert type="error" title={message} showIcon style={{ marginBottom: 16 }} />
			)}
			<Form
				form={form}
				layout="vertical"
				initialValues={initialValues}
				onFinish={onFinish}
				disabled={pending}
				requiredMark="optional"
			>
				<Form.Item
					label="RUT"
					name="rut"
					rules={[
						{ required: true, whitespace: true, message: "El RUT es obligatorio." },
						{
							validator: (_, value?: string) =>
								!value?.trim() || validarRut(value)
									? Promise.resolve()
									: Promise.reject(new Error("RUT inválido.")),
						},
					]}
				>
					<Input placeholder="12.345.678-5" maxLength={12} onBlur={formatRutOnBlur} />
				</Form.Item>
				<Form.Item
					label="Nombre"
					name="name"
					rules={[{ required: true, whitespace: true, message: "El nombre es obligatorio." }]}
				>
					<Input placeholder="Nombre o razón social" maxLength={150} />
				</Form.Item>
				<Form.Item
					label="Correo"
					name="email"
					rules={[{ type: "email", message: "Correo inválido." }]}
				>
					<Input placeholder="cliente@correo.cl" maxLength={150} />
				</Form.Item>
				<Form.Item label="Teléfono" name="phone">
					<Input placeholder="+56 9 1234 5678" maxLength={30} />
				</Form.Item>
				<Flex gap="small" justify="end">
					<Link href="/clients">
						<Button disabled={pending}>Cancelar</Button>
					</Link>
					<Button type="primary" htmlType="submit" loading={pending}>
						{submitLabel}
					</Button>
				</Flex>
			</Form>
		</Card>
	);
}
