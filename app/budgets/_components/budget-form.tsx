"use client";

import {
	Alert,
	Button,
	Card,
	Col,
	Descriptions,
	Flex,
	Form,
	Input,
	InputNumber,
	Modal,
	Row,
	Select,
	Space,
	Typography,
} from "antd";
import { formatearRut, sumarDias, validarRut } from "cotizacion-cl";
import { PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { ClientForm } from "@/app/clients/_components/client-form";
import { VehicleForm } from "@/app/vehicles/_components/vehicle-form";
import { createClientInline } from "@/lib/actions/clients";
import { createVehicleInline } from "@/lib/actions/vehicles";
import {
	BUDGET_CATEGORIES,
	previewTotals,
	type BudgetCategory,
	type BudgetLineAmounts,
} from "@/lib/budgets/calculation";
import type { BudgetVehicleOption, ServiceTypeOption } from "@/lib/budgets/queries";
import {
	MAX_LINES,
	MAX_VALIDITY_DAYS,
	type BudgetActionState,
	type BudgetInput,
	type BudgetLineInput,
} from "@/lib/budgets/validation";
import type { ClientOption } from "@/lib/clients/queries";
import type { ClientActionState, ClientInput } from "@/lib/clients/validation";
import { formatCLP, formatDate } from "@/lib/format";
import { normalizePlate, type VehicleActionState, type VehicleInput } from "@/lib/vehicles/validation";

type BudgetFormProps = {
	submitLabel: string;
	clients: ClientOption[];
	vehicles: BudgetVehicleOption[];
	serviceTypes: ServiceTypeOption[];
	initialValues: Partial<BudgetInput>;
	action: (values: BudgetInput) => Promise<BudgetActionState>;
	/** Presupuesto anulado: solo lectura. */
	readOnly?: boolean;
	/** Acciones extra junto a los botones (p. ej. "Anular"). */
	extraActions?: ReactNode;
};

const categoryOptions = (Object.keys(BUDGET_CATEGORIES) as BudgetCategory[]).map((value) => ({
	value,
	label: BUDGET_CATEGORIES[value],
}));

const NEW_LINE: Partial<BudgetLineInput> = { category: "mano_obra", quantity: 1 };

const thousands = (value?: string | number) =>
	value === undefined || value === "" ? "" : String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const parseThousands = (value?: string) =>
	(value ? Number(value.replace(/\D/g, "")) : null) as unknown as number;

/** Líneas del formulario (posiblemente incompletas) → entrada de la vista previa. */
function previewLines(lines: Partial<BudgetLineInput>[] | undefined): {
	lines: BudgetLineAmounts[];
	index: number[];
} {
	const result: BudgetLineAmounts[] = [];
	const index: number[] = [];
	(lines ?? []).forEach((line, i) => {
		const quantity = Number(line?.quantity);
		if (!(quantity > 0)) return;
		const unitAmount = Number(line?.unitAmount);
		result.push({
			category: line?.category ?? "otro",
			description: line?.description?.trim() || "—",
			quantity,
			unitAmount: unitAmount >= 0 ? unitAmount : 0,
		});
		index.push(i);
	});
	return { lines: result, index };
}

export function BudgetForm({
	submitLabel,
	clients: initialClients,
	vehicles: initialVehicles,
	serviceTypes,
	initialValues,
	action,
	readOnly = false,
	extraActions,
}: BudgetFormProps) {
	const [form] = Form.useForm<BudgetInput>();
	const [pending, startTransition] = useTransition();
	const [message, setMessage] = useState<string>();

	// Listas locales: se amplían con los clientes/vehículos creados desde aquí.
	const [clients, setClients] = useState(initialClients);
	const [vehicles, setVehicles] = useState(initialVehicles);
	// Texto buscado en cada selector: se usa para precargar el alta.
	const [clientSearch, setClientSearch] = useState("");
	const [vehicleSearch, setVehicleSearch] = useState("");
	const [creating, setCreating] = useState<
		{ kind: "client"; values: Partial<ClientInput> } | { kind: "vehicle"; values: Partial<VehicleInput> } | null
	>(null);

	// `useWatch` devuelve `undefined` en el primer render: se usan los valores iniciales.
	const clientId = Form.useWatch("clientId", form) ?? initialValues.clientId;
	const date = Form.useWatch("date", form) ?? initialValues.date;
	const validityDays = Form.useWatch("validityDays", form) ?? initialValues.validityDays;
	const lines = (Form.useWatch("lines", form) ?? initialValues.lines) as
		| Partial<BudgetLineInput>[]
		| undefined;
	const discount = Form.useWatch("discount", form) ?? initialValues.discount;

	const clientOptions = useMemo(
		() => clients.map((c) => ({ value: c.id, label: `${c.name} · ${formatearRut(c.rut)}` })),
		[clients],
	);
	const serviceTypeOptions = useMemo(
		() => serviceTypes.map((t) => ({ value: t.id, label: t.name })),
		[serviceTypes],
	);

	const clientVehicles = useMemo(
		() => (clientId ? vehicles.filter((v) => v.ownerIds.includes(clientId)) : []),
		[vehicles, clientId],
	);
	// Si el cliente no tiene vehículos asignados, se ofrecen todos.
	const vehicleOptions = (clientVehicles.length > 0 ? clientVehicles : vehicles).map((v) => ({
		value: v.id,
		label: `${v.plate} · ${v.brand} ${v.model}`,
	}));

	const preview = useMemo(() => {
		const { lines: amounts, index } = previewLines(lines);
		const result = previewTotals(amounts, Number(discount) || 0);
		const lineAmounts = new Map<number, number>();
		if (result.ok) result.totals.lineAmounts.forEach((amount, i) => lineAmounts.set(index[i], amount));
		return { result, lineAmounts };
	}, [lines, discount]);

	const expiresOn =
		typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number(validityDays) > 0
			? sumarDias(date, Number(validityDays))
			: null;

	function onClientChange(id: number | undefined) {
		const owned = id ? vehicles.filter((v) => v.ownerIds.includes(id)) : [];
		const current = form.getFieldValue("vehicleId");
		if (owned.length === 1) form.setFieldValue("vehicleId", owned[0].id);
		else if (owned.length > 1 && !owned.some((v) => v.id === current))
			form.setFieldValue("vehicleId", undefined);
	}

	function openNewClient() {
		const text = clientSearch.trim();
		setCreating({
			kind: "client",
			values: text ? (validarRut(text) ? { rut: formatearRut(text) } : { name: text }) : {},
		});
	}

	function openNewVehicle() {
		const plate = normalizePlate(vehicleSearch.trim());
		setCreating({
			kind: "vehicle",
			values: {
				...(plate ? { plate } : {}),
				// El vehículo nuevo queda asignado al cliente seleccionado.
				clientIds: clientId ? [clientId] : [],
			},
		});
	}

	async function createClient(values: ClientInput): Promise<ClientActionState> {
		const result = await createClientInline(values);
		if (!result.ok) return result;
		const { client } = result;
		setClients((list) =>
			[...list.filter((c) => c.id !== client.id), client].sort((a, b) => a.name.localeCompare(b.name, "es")),
		);
		form.setFields([{ name: "clientId", value: client.id, errors: [] }]);
		onClientChange(client.id);
		setClientSearch("");
		setCreating(null);
		return { ok: true };
	}

	async function createVehicle(values: VehicleInput): Promise<VehicleActionState> {
		const result = await createVehicleInline(values);
		if (!result.ok) return result;
		const { vehicle } = result;
		setVehicles((list) =>
			[...list.filter((v) => v.id !== vehicle.id), vehicle].sort((a, b) => a.plate.localeCompare(b.plate)),
		);
		form.setFields([{ name: "vehicleId", value: vehicle.id, errors: [] }]);
		setVehicleSearch("");
		setCreating(null);
		return { ok: true };
	}

	function onFinish(values: BudgetInput) {
		setMessage(undefined);
		startTransition(async () => {
			const result = await action({ ...values, discount: values.discount ?? 0, lines: values.lines ?? [] });
			if (result.ok) return;
			const errors = result.fieldErrors ?? {};
			const messages = [result.message, errors.lines].filter(Boolean);
			setMessage(messages.join(" ") || (Object.keys(errors).length ? "Revisa los campos marcados." : undefined));
			form.setFields(
				Object.entries(errors)
					.filter(([key]) => key !== "lines")
					.map(([key, error]) => ({
						name: key.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part)) as never,
						errors: [error],
					})),
			);
		});
	}

	const totals = preview.result.ok ? preview.result.totals : null;

	return (
		<>
			<Form
				form={form}
				layout="vertical"
				initialValues={{ lines: [NEW_LINE], discount: 0, ...initialValues }}
				onFinish={onFinish}
				disabled={pending || readOnly}
				requiredMark="optional"
			>
				<Flex vertical gap="middle">
					{message && <Alert type="error" title={message} showIcon />}

					<Card title="Cliente y vehículo" size="small">
						<Row gutter={16}>
							<Col xs={24} md={12}>
								<Form.Item
									label="Cliente"
									required
									extra={clients.length === 0 ? "No hay clientes: crea uno con «Nuevo»." : undefined}
								>
									<Space.Compact block>
										<Form.Item
											name="clientId"
											noStyle
											rules={[{ required: true, message: "Selecciona un cliente." }]}
										>
											<Select
												showSearch={{
													optionFilterProp: "label",
													searchValue: clientSearch,
													onSearch: setClientSearch,
												}}
												placeholder="Buscar por nombre o RUT"
												options={clientOptions}
												onChange={(id: number | undefined) => {
													setClientSearch("");
													onClientChange(id);
												}}
												notFoundContent={
													readOnly ? "Sin coincidencias" : (
														<Button type="link" icon={<PlusIcon size={14} />} onClick={openNewClient}>
															{clientSearch.trim() ? `Crear cliente «${clientSearch.trim()}»` : "Crear cliente"}
														</Button>
													)
												}
											/>
										</Form.Item>
										{!readOnly && (
											<Button icon={<PlusIcon size={16} />} onClick={openNewClient}>
												Nuevo
											</Button>
										)}
									</Space.Compact>
								</Form.Item>
							</Col>
							<Col xs={24} md={12}>
								<Form.Item
									label="Vehículo"
									required
									extra={
										vehicles.length === 0
											? "No hay vehículos: crea uno con «Nuevo»."
											: clientId && clientVehicles.length === 0
												? "El cliente no tiene vehículos asignados: se muestran todos."
												: undefined
									}
								>
									<Space.Compact block>
										<Form.Item
											name="vehicleId"
											noStyle
											rules={[{ required: true, message: "Selecciona un vehículo." }]}
										>
											<Select
												showSearch={{
													optionFilterProp: "label",
													searchValue: vehicleSearch,
													onSearch: setVehicleSearch,
												}}
												placeholder="Buscar por patente"
												options={vehicleOptions}
												onChange={() => setVehicleSearch("")}
												notFoundContent={
													readOnly ? "Sin coincidencias" : (
														<Button type="link" icon={<PlusIcon size={14} />} onClick={openNewVehicle}>
															{vehicleSearch.trim()
																? `Crear vehículo «${normalizePlate(vehicleSearch.trim())}»`
																: "Crear vehículo"}
														</Button>
													)
												}
											/>
										</Form.Item>
										{!readOnly && (
											<Button icon={<PlusIcon size={16} />} onClick={openNewVehicle}>
												Nuevo
											</Button>
										)}
									</Space.Compact>
								</Form.Item>
							</Col>
						</Row>
					</Card>

					<Card title="Datos del presupuesto" size="small">
						<Row gutter={16}>
							<Col xs={24} sm={8}>
								<Form.Item
									label="Fecha"
									name="date"
									rules={[{ required: true, message: "La fecha es obligatoria." }]}
								>
									<Input type="date" />
								</Form.Item>
							</Col>
							<Col xs={24} sm={8}>
								<Form.Item
									label="Validez"
									name="validityDays"
									rules={[{ required: true, message: "Indica los días de validez." }]}
									extra={expiresOn ? `Vence el ${formatDate(expiresOn)}` : undefined}
								>
									<InputNumber
										min={1}
										max={MAX_VALIDITY_DAYS}
										precision={0}
										suffix="días"
										style={{ width: "100%" }}
									/>
								</Form.Item>
							</Col>
							<Col xs={24} sm={8}>
								<Form.Item label="Entrega estimada" name="estimatedDeliveryDate">
									<Input type="date" min={typeof date === "string" ? date : undefined} />
								</Form.Item>
							</Col>
						</Row>
						<Form.Item label="Diagnóstico" name="diagnosis">
							<Input.TextArea rows={3} maxLength={5000} placeholder="Falla informada y diagnóstico" />
						</Form.Item>
					</Card>

					<Card title="Detalle" size="small">
						<Form.List name="lines">
							{(fields, { add, remove }) => (
								<Flex vertical gap="small">
									{fields.map((field, i) => (
										<Row key={field.key} gutter={8} align="top" wrap>
											<Col xs={12} md={4}>
												<Form.Item
													name={[field.name, "category"]}
													label={i === 0 ? "Categoría" : undefined}
													rules={[{ required: true, message: "Obligatoria." }]}
												>
													<Select options={categoryOptions} />
												</Form.Item>
											</Col>
											<Col xs={12} md={4}>
												<Form.Item
													name={[field.name, "serviceTypeId"]}
													label={i === 0 ? "Tipo de servicio" : undefined}
													rules={[{ required: true, message: "Obligatorio." }]}
												>
													<Select
														options={serviceTypeOptions}
														placeholder="Tipo"
														showSearch={{ optionFilterProp: "label" }}
													/>
												</Form.Item>
											</Col>
											<Col xs={24} md={7}>
												<Form.Item
													name={[field.name, "description"]}
													label={i === 0 ? "Descripción" : undefined}
													rules={[{ required: true, whitespace: true, message: "Obligatoria." }]}
												>
													<Input maxLength={255} placeholder="Repuesto o trabajo" />
												</Form.Item>
											</Col>
											<Col xs={8} md={2}>
												<Form.Item
													name={[field.name, "quantity"]}
													label={i === 0 ? "Cant." : undefined}
													rules={[{ required: true, message: "Obligatoria." }]}
												>
													<InputNumber min={0.01} precision={2} step={1} style={{ width: "100%" }} />
												</Form.Item>
											</Col>
											<Col xs={8} md={3}>
												<Form.Item
													name={[field.name, "unitAmount"]}
													label={i === 0 ? "Precio unit. (neto)" : undefined}
													rules={[{ required: true, message: "Obligatorio." }]}
												>
													<InputNumber
														min={0}
														precision={0}
														prefix="$"
														formatter={thousands}
														parser={parseThousands}
														style={{ width: "100%" }}
													/>
												</Form.Item>
											</Col>
											<Col xs={6} md={3}>
												<Form.Item label={i === 0 ? "Monto" : undefined}>
													<Typography.Text strong style={{ lineHeight: "32px" }}>
														{preview.lineAmounts.has(field.name)
															? formatCLP(preview.lineAmounts.get(field.name)!)
															: "—"}
													</Typography.Text>
												</Form.Item>
											</Col>
											<Col xs={2} md={1}>
												<Form.Item label={i === 0 ? " " : undefined}>
													<Button
														type="text"
														danger
														icon={<Trash2Icon size={16} />}
														aria-label="Quitar línea"
														disabled={readOnly || pending || fields.length === 1}
														onClick={() => remove(field.name)}
													/>
												</Form.Item>
											</Col>
										</Row>
									))}
									{!readOnly && (
										<Button
											type="dashed"
											icon={<PlusIcon size={16} />}
											onClick={() => add({ ...NEW_LINE })}
											disabled={fields.length >= MAX_LINES}
											block
										>
											Agregar línea
										</Button>
									)}
									{serviceTypes.length === 0 && (
										<Alert
											type="warning"
											showIcon
											title="No hay tipos de servicio. Créalos con .harness/sql/004_datos_base.sql."
										/>
									)}
								</Flex>
							)}
						</Form.List>
					</Card>

					<Row gutter={16}>
						<Col xs={24} md={14}>
							<Card title="Observaciones" size="small" style={{ height: "100%" }}>
								<Form.Item name="additionalObservations" style={{ marginBottom: 0 }}>
									<Input.TextArea
										rows={6}
										maxLength={5000}
										placeholder="Condiciones, garantía, forma de pago…"
									/>
								</Form.Item>
							</Card>
						</Col>
						<Col xs={24} md={10}>
							<Card title="Totales" size="small">
								<Form.Item label="Descuento (monto neto)" name="discount">
									<InputNumber
										min={0}
										precision={0}
										prefix="$"
										formatter={thousands}
										parser={parseThousands}
										style={{ width: "100%" }}
									/>
								</Form.Item>
								{!preview.result.ok && (
									<Alert
										type="warning"
										showIcon
										style={{ marginBottom: 12 }}
										title={preview.result.errors.map((e) => e.mensaje).join("; ")}
									/>
								)}
								<Descriptions
									column={1}
									size="small"
									bordered
									items={[
										{ label: BUDGET_CATEGORIES.repuesto, children: formatCLP(totals?.sparePartsAmount ?? 0) },
										{ label: BUDGET_CATEGORIES.mano_obra, children: formatCLP(totals?.labourAmount ?? 0) },
										{ label: BUDGET_CATEGORIES.otro, children: formatCLP(totals?.otherChargesAmount ?? 0) },
										{ label: "Descuento", children: `− ${formatCLP(totals?.discount ?? 0)}` },
										{ label: "Neto", children: formatCLP(totals?.netoAmount ?? 0) },
										{ label: "IVA (19 %)", children: formatCLP(totals?.ivaAmount ?? 0) },
										{
											label: <strong>Total</strong>,
											children: <strong>{formatCLP(totals?.totalAmount ?? 0)}</strong>,
										},
									]}
								/>
							</Card>
						</Col>
					</Row>

					<Flex gap="small" justify="end" wrap>
						{extraActions}
						<Link href="/budgets">
							<Button disabled={pending}>{readOnly ? "Volver" : "Cancelar"}</Button>
						</Link>
						{!readOnly && (
							<Button type="primary" htmlType="submit" loading={pending}>
								{submitLabel}
							</Button>
						)}
					</Flex>
				</Flex>
			</Form>

			{/* Fuera del <Form> del presupuesto: cada alta tiene su propio formulario. */}
			<Modal
				title="Nuevo cliente"
				open={creating?.kind === "client"}
				onCancel={() => setCreating(null)}
				footer={null}
				destroyOnHidden
				width={560}
			>
				{creating?.kind === "client" && (
					<ClientForm
						submitLabel="Crear y seleccionar"
						initialValues={creating.values as ClientInput}
						action={createClient}
						onCancel={() => setCreating(null)}
					/>
				)}
			</Modal>
			<Modal
				title="Nuevo vehículo"
				open={creating?.kind === "vehicle"}
				onCancel={() => setCreating(null)}
				footer={null}
				destroyOnHidden
				width={760}
			>
				{creating?.kind === "vehicle" && (
					<VehicleForm
						submitLabel="Crear y seleccionar"
						clients={clients}
						initialValues={creating.values as VehicleInput}
						action={createVehicle}
						onCancel={() => setCreating(null)}
					/>
				)}
			</Modal>
		</>
	);
}
