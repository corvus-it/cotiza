"use client";

import { Alert, App, Button, Col, Flex, Form, Input, Row } from "antd";
import { formatearRut, validarRut } from "cotizacion-cl";
import { useState, useTransition } from "react";
import { updateCompany } from "@/lib/actions/company";
import type { CompanyFieldErrors, CompanyInput } from "@/lib/company/validation";

const PLACEHOLDER = /<<.*>>/;

/** Quita los valores de ejemplo del seed (`<<...>>`) para no mostrarlos como datos reales. */
function withoutPlaceholders(company: CompanyInput): CompanyInput {
	return Object.fromEntries(
		Object.entries(company).map(([key, value]) => [
			key,
			typeof value === "string" && PLACEHOLDER.test(value) ? undefined : (value ?? undefined),
		]),
	) as CompanyInput;
}

export function CompanyForm({ company, readOnly }: { company: CompanyInput; readOnly: boolean }) {
	const { message: toast } = App.useApp();
	const [form] = Form.useForm<CompanyInput>();
	const [pending, startTransition] = useTransition();
	const [message, setMessage] = useState<string>();
	const initialValues = withoutPlaceholders({
		...company,
		rut: validarRut(company.rut) ? formatearRut(company.rut) : company.rut,
	});

	function onFinish(values: CompanyInput) {
		setMessage(undefined);
		startTransition(async () => {
			const result = await updateCompany(values);
			if (result.ok) {
				toast.success("Datos de la empresa guardados.");
				return;
			}
			setMessage(result.message);
			const errors: CompanyFieldErrors = result.fieldErrors ?? {};
			form.setFields(
				(Object.keys(errors) as (keyof CompanyInput)[]).map((name) => ({ name, errors: [errors[name]!] })),
			);
		});
	}

	function formatRutOnBlur() {
		const rut = form.getFieldValue("rut");
		if (typeof rut === "string" && validarRut(rut)) form.setFieldValue("rut", formatearRut(rut));
	}

	const urlRule = {
		type: "url" as const,
		message: "URL inválida (debe empezar con http:// o https://).",
	};

	return (
		<Form
			form={form}
			layout="vertical"
			initialValues={initialValues}
			onFinish={onFinish}
			disabled={pending || readOnly}
			requiredMark="optional"
			style={{ maxWidth: 860 }}
		>
			{message && <Alert type="error" title={message} showIcon style={{ marginBottom: 16 }} />}
			<Row gutter={16}>
				<Col xs={24} sm={8}>
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
						<Input placeholder="76.123.456-0" maxLength={12} onBlur={formatRutOnBlur} />
					</Form.Item>
				</Col>
				<Col xs={24} sm={16}>
					<Form.Item
						label="Razón social"
						name="name"
						rules={[{ required: true, whitespace: true, message: "La razón social es obligatoria." }]}
					>
						<Input placeholder="Taller Mecánico SpA" maxLength={150} />
					</Form.Item>
				</Col>
				<Col xs={24}>
					<Form.Item label="Giro" name="businessActivity">
						<Input placeholder="Reparación y mantención de vehículos motorizados" maxLength={255} />
					</Form.Item>
				</Col>
				<Col xs={24} sm={12}>
					<Form.Item label="Dirección" name="address">
						<Input placeholder="Av. Siempre Viva 742" maxLength={255} />
					</Form.Item>
				</Col>
				<Col xs={12} sm={6}>
					<Form.Item label="Comuna" name="commune">
						<Input placeholder="Providencia" maxLength={80} />
					</Form.Item>
				</Col>
				<Col xs={12} sm={6}>
					<Form.Item label="Ciudad" name="city">
						<Input placeholder="Santiago" maxLength={80} />
					</Form.Item>
				</Col>
				<Col xs={24} sm={12}>
					<Form.Item label="Correo" name="email" rules={[{ type: "email", message: "Correo inválido." }]}>
						<Input placeholder="contacto@empresa.cl" maxLength={150} />
					</Form.Item>
				</Col>
				<Col xs={24} sm={12}>
					<Form.Item label="Teléfono" name="phone">
						<Input placeholder="+56 9 1234 5678" maxLength={30} />
					</Form.Item>
				</Col>
				<Col xs={24} sm={12}>
					<Form.Item label="Sitio web" name="website" rules={[urlRule]}>
						<Input placeholder="https://empresa.cl" maxLength={255} />
					</Form.Item>
				</Col>
				<Col xs={24} sm={12}>
					<Form.Item
						label="Logo (URL)"
						name="logo"
						rules={[urlRule]}
						extra="URL pública de la imagen del logo."
					>
						<Input placeholder="https://empresa.cl/logo.png" maxLength={500} />
					</Form.Item>
				</Col>
			</Row>
			{!readOnly && (
				<Flex gap="small" justify="end">
					<Button onClick={() => form.resetFields()} disabled={pending}>
						Descartar cambios
					</Button>
					<Button type="primary" htmlType="submit" loading={pending}>
						Guardar
					</Button>
				</Flex>
			)}
		</Form>
	);
}
