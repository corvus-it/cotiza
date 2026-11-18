"use client";

import { Alert, Button, Card, Col, Flex, Form, Input, InputNumber, Row, Select } from "antd";
import { formatearRut } from "cotizacion-cl";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { ClientOption } from "@/lib/clients/queries";
import {
	FUEL_TYPES,
	YEAR_MIN,
	maxVehicleYear,
	normalizePlate,
	type VehicleActionState,
	type VehicleFieldErrors,
	type VehicleInput,
} from "@/lib/vehicles/validation";

type VehicleFormProps = {
	submitLabel: string;
	clients: ClientOption[];
	initialValues?: VehicleInput;
	action: (values: VehicleInput) => Promise<VehicleActionState>;
	/**
	 * Modo embebido (p. ej. dentro de un modal): sin tarjeta ni título y
	 * "Cancelar" llama a este callback en vez de volver al listado.
	 */
	onCancel?: () => void;
};

const thousands = (value?: string | number) =>
	value === undefined || value === "" ? "" : String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function VehicleForm({
	submitLabel,
	clients,
	initialValues,
	action,
	onCancel,
}: VehicleFormProps) {
	const [form] = Form.useForm<VehicleInput>();
	const [pending, startTransition] = useTransition();
	const [message, setMessage] = useState<string>();
	const maxYear = maxVehicleYear();

	const clientOptions = useMemo(
		() => clients.map((c) => ({ value: c.id, label: `${c.name} · ${formatearRut(c.rut)}` })),
		[clients],
	);
	const fuelOptions = useMemo(() => {
		const values: string[] = [...FUEL_TYPES];
		// Conserva un valor existente que no esté en la lista sugerida.
		const current = initialValues?.fuelType;
		if (current && !values.includes(current)) values.push(current);
		return values.map((v) => ({ value: v, label: v }));
	}, [initialValues?.fuelType]);

	function onFinish(values: VehicleInput) {
		setMessage(undefined);
		startTransition(async () => {
			const result = await action({ ...values, clientIds: values.clientIds ?? [] });
			if (result.ok) return;
			setMessage(result.message);
			const errors: VehicleFieldErrors = result.fieldErrors ?? {};
			form.setFields(
				(Object.keys(errors) as (keyof VehicleInput)[]).map((name) => ({
					name,
					errors: [errors[name]!],
				})),
			);
		});
	}

	const content = (
		<>
			{message && <Alert type="error" title={message} showIcon style={{ marginBottom: 16 }} />}
			<Form
				form={form}
				layout="vertical"
				initialValues={initialValues}
				onFinish={onFinish}
				disabled={pending}
				requiredMark="optional"
			>
				<Row gutter={16}>
					<Col xs={24} sm={8}>
						<Form.Item
							label="Patente"
							name="plate"
							normalize={(v?: string) => (v ? normalizePlate(v) : v)}
							rules={[
								{ required: true, whitespace: true, message: "La patente es obligatoria." },
								{ pattern: /^[A-Z0-9]{4,10}$/, message: "Patente inválida." },
							]}
						>
							<Input placeholder="ABCD12" maxLength={10} />
						</Form.Item>
					</Col>
					<Col xs={24} sm={8}>
						<Form.Item
							label="Marca"
							name="brand"
							rules={[{ required: true, whitespace: true, message: "La marca es obligatoria." }]}
						>
							<Input placeholder="Toyota" maxLength={80} />
						</Form.Item>
					</Col>
					<Col xs={24} sm={8}>
						<Form.Item
							label="Modelo"
							name="model"
							rules={[{ required: true, whitespace: true, message: "El modelo es obligatorio." }]}
						>
							<Input placeholder="Yaris" maxLength={80} />
						</Form.Item>
					</Col>
					<Col xs={24} sm={8}>
						<Form.Item label="Año" name="year">
							<InputNumber
								min={YEAR_MIN}
								max={maxYear}
								precision={0}
								placeholder={String(maxYear - 1)}
								style={{ width: "100%" }}
							/>
						</Form.Item>
					</Col>
					<Col xs={24} sm={8}>
						<Form.Item label="Motor" name="motor">
							<Input placeholder="1.5 VVT-i" maxLength={80} />
						</Form.Item>
					</Col>
					<Col xs={24} sm={8}>
						<Form.Item label="Combustible" name="fuelType">
							<Select allowClear placeholder="Seleccionar" options={fuelOptions} />
						</Form.Item>
					</Col>
					<Col xs={24} sm={8}>
						<Form.Item label="Kilometraje" name="mileage">
							<InputNumber
								min={0}
								precision={0}
								placeholder="0"
								formatter={thousands}
								parser={(v) => (v ? Number(v.replace(/\D/g, "")) : (null as unknown as number))}
								suffix="km"
								style={{ width: "100%" }}
							/>
						</Form.Item>
					</Col>
					<Col xs={24} sm={onCancel ? 24 : 16}>
						<Form.Item
							label="Dueños"
							name="clientIds"
							extra={
								clients.length === 0 ? (
									<>
										No hay clientes. <Link href="/clients/new-client">Crear cliente</Link>
									</>
								) : undefined
							}
						>
							<Select
								mode="multiple"
								allowClear
								showSearch={{ optionFilterProp: "label" }}
								placeholder="Sin asignar"
								options={clientOptions}
								notFoundContent="Sin coincidencias"
							/>
						</Form.Item>
					</Col>
				</Row>
				<Flex gap="small" justify="end">
					{onCancel ? (
						<Button disabled={pending} onClick={onCancel}>
							Cancelar
						</Button>
					) : (
						<Link href="/vehicles">
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
		<Card style={{ maxWidth: 760 }}>
			{content}
		</Card>
	);
}
