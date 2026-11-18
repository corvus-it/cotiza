"use client";

import { Alert, Button, Card, Flex, Form, Input, Select } from "antd";
import { formatearRut, validarRut } from "cotizacion-cl";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type {
	ClientActionState,
	ClientFieldErrors,
	ClientInput,
} from "@/lib/clients/validation";
import type { VehicleOption } from "@/lib/vehicles/queries";

type ClientFormProps = {
	submitLabel: string;
	/** Vehículos asignables. Si se omite, no se muestra el campo. */
	vehicles?: VehicleOption[];
	initialValues?: ClientInput;
	action: (values: ClientInput) => Promise<ClientActionState>;
	/**
	 * Modo embebido (p. ej. dentro de un modal): sin tarjeta ni título y
	 * "Cancelar" llama a este callback en vez de volver al listado.
	 */
	onCancel?: () => void;
};

export function ClientForm({
	submitLabel,
	vehicles,
	initialValues,
	action,
	onCancel,
}: ClientFormProps) {
	const [form] = Form.useForm<ClientInput>();
	const [pending, startTransition] = useTransition();
	const [message, setMessage] = useState<string>();
	const vehicleOptions = useMemo(
		() => (vehicles ?? []).map((v) => ({ value: v.id, label: `${v.plate} · ${v.brand} ${v.model}` })),
		[vehicles],
	);

	function onFinish(values: ClientInput) {
		setMessage(undefined);
		startTransition(async () => {
			const result = await action({ ...values, vehicleIds: values.vehicleIds ?? [] });
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

	const content = (
		<>
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
				{vehicles && (
				<Form.Item
					label="Vehículos"
					name="vehicleIds"
					extra={
						vehicles.length === 0 ? (
							<>
								No hay vehículos. <Link href="/vehicles/new-vehicle">Crear vehículo</Link>
							</>
						) : undefined
					}
				>
					<Select
						mode="multiple"
						allowClear
						showSearch={{ optionFilterProp: "label" }}
						placeholder="Sin vehículos"
						options={vehicleOptions}
						notFoundContent="Sin coincidencias"
					/>
				</Form.Item>
				)}
				<Flex gap="small" justify="end">
					{onCancel ? (
						<Button disabled={pending} onClick={onCancel}>
							Cancelar
						</Button>
					) : (
						<Link href="/clients">
							<Button disabled={pending}>Cancelar</Button>
						</Link>
					)}
					<Button type="primary" htmlType="submit" loading={pending}>
						{submitLabel}
					</Button>
				</Flex>
			</Form>
		</>
	);

	if (onCancel) return content;
	return (
		<Card style={{ maxWidth: 640 }}>
			{content}
		</Card>
	);
}
