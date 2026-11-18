"use client";

import {
	Alert,
	App,
	Button,
	Flex,
	Form,
	Input,
	Modal,
	Popconfirm,
	Select,
	Space,
	Table,
	Tag,
	Typography,
	type TableColumnsType,
} from "antd";
import { PencilIcon, PlusIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { createWorker, setWorkerActive, updateWorker } from "@/lib/actions/company";
import type { RoleOption, Worker } from "@/lib/company/queries";
import {
	ADMIN_ROLE,
	PASSWORD_MAX,
	PASSWORD_MIN,
	type WorkerActionState,
	type WorkerFieldErrors,
	type WorkerInput,
} from "@/lib/company/validation";

/** Fecha en hora de Chile (fija para que servidor y navegador coincidan). */
const DATE_CL = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago" });

type WorkersTableProps = {
	workers: Worker[];
	roles: RoleOption[];
	currentUserId: number;
	readOnly: boolean;
};

/** `null` = modal cerrado; `"new"` = alta; un trabajador = edición. */
type Editing = null | "new" | Worker;

export function WorkersTable({ workers, roles, currentUserId, readOnly }: WorkersTableProps) {
	const { message } = App.useApp();
	const [editing, setEditing] = useState<Editing>(null);
	const [toggling, startToggle] = useTransition();

	function onToggle(worker: Worker) {
		startToggle(async () => {
			const result = await setWorkerActive(worker.id, !worker.active);
			if (result.ok)
				message.success(`${worker.name} ${worker.active ? "ya no puede ingresar" : "puede volver a ingresar"}.`);
			else message.error(result.message ?? "No se pudo actualizar el trabajador.");
		});
	}

	const columns: TableColumnsType<Worker> = [
		{
			title: "Nombre",
			dataIndex: "name",
			render: (name: string, worker) => (
				<Space size={4}>
					{name}
					{worker.id === currentUserId && <Tag color="blue">Tú</Tag>}
				</Space>
			),
		},
		{ title: "Correo", dataIndex: "email" },
		{
			title: "Rol",
			dataIndex: "roleName",
			render: (roleName: string, worker) => (
				<Tag color={worker.roleCode === ADMIN_ROLE ? "gold" : undefined}>{roleName || worker.roleCode}</Tag>
			),
		},
		{
			title: "Estado",
			dataIndex: "active",
			render: (active: boolean) =>
				active ? <Tag color="green">Activo</Tag> : <Tag color="default">Inactivo</Tag>,
			width: 100,
		},
		{
			title: "Alta",
			dataIndex: "createdAt",
			render: (createdAt: Date) => DATE_CL.format(createdAt),
			width: 120,
		},
	];

	if (!readOnly) {
		columns.push({
			title: "Acciones",
			key: "actions",
			align: "right",
			width: 120,
			render: (_, worker) => (
				<Space>
					<Button
						icon={<PencilIcon size={16} />}
						aria-label={`Editar ${worker.name}`}
						onClick={() => setEditing(worker)}
					/>
					{worker.id !== currentUserId && (
						<Popconfirm
							title={worker.active ? "Desactivar trabajador" : "Reactivar trabajador"}
							description={
								worker.active
									? `${worker.name} ya no podrá ingresar. Sus presupuestos se conservan.`
									: `${worker.name} podrá volver a ingresar.`
							}
							okText={worker.active ? "Desactivar" : "Reactivar"}
							cancelText="Cancelar"
							okButtonProps={{ danger: worker.active }}
							onConfirm={() => onToggle(worker)}
						>
							<Button
								danger={worker.active}
								icon={worker.active ? <UserXIcon size={16} /> : <UserCheckIcon size={16} />}
								aria-label={`${worker.active ? "Desactivar" : "Reactivar"} ${worker.name}`}
							/>
						</Popconfirm>
					)}
				</Space>
			),
		});
	}

	return (
		<Flex vertical gap="middle">
			<Flex justify="space-between" align="center" wrap gap="small">
				<Typography.Text type="secondary">
					Usuarios que pueden ingresar con esta empresa. Los administradores gestionan la empresa y sus
					trabajadores.
				</Typography.Text>
				{!readOnly && (
					<Button type="primary" icon={<PlusIcon size={16} />} onClick={() => setEditing("new")}>
						Nuevo trabajador
					</Button>
				)}
			</Flex>
			<Table<Worker>
				rowKey="id"
				columns={columns}
				dataSource={workers}
				loading={toggling}
				pagination={{ pageSize: 20, hideOnSinglePage: true }}
				locale={{ emptyText: "Aún no hay trabajadores." }}
				rowClassName={(worker) => (worker.active ? "" : "opacity-60")}
				scroll={{ x: 760 }}
			/>
			<Modal
				title={editing === "new" ? "Nuevo trabajador" : "Editar trabajador"}
				open={editing !== null}
				onCancel={() => setEditing(null)}
				footer={null}
				destroyOnHidden
			>
				{editing !== null && (
					<WorkerForm
						worker={editing === "new" ? null : editing}
						roles={roles}
						isSelf={editing !== "new" && editing.id === currentUserId}
						onDone={(text) => {
							message.success(text);
							setEditing(null);
						}}
						onCancel={() => setEditing(null)}
					/>
				)}
			</Modal>
		</Flex>
	);
}

type WorkerFormProps = {
	worker: Worker | null;
	roles: RoleOption[];
	isSelf: boolean;
	onDone: (message: string) => void;
	onCancel: () => void;
};

function WorkerForm({ worker, roles, isSelf, onDone, onCancel }: WorkerFormProps) {
	const [form] = Form.useForm<WorkerInput & { confirmPassword?: string }>();
	const [pending, startTransition] = useTransition();
	const [message, setMessage] = useState<string>();
	const isNew = worker === null;

	const roleOptions = useMemo(() => {
		const options = roles.map((r) => ({ value: r.id, label: r.name || r.code }));
		// Conserva el rol actual aunque esté inactivo.
		if (worker && !roles.some((r) => r.id === worker.roleId))
			options.push({ value: worker.roleId, label: worker.roleName || worker.roleCode });
		return options;
	}, [roles, worker]);

	const defaultRoleId = roles.find((r) => r.code !== ADMIN_ROLE)?.id ?? roles[0]?.id;

	function onFinish({ name, email, roleId, password }: WorkerInput & { confirmPassword?: string }) {
		const values: WorkerInput = { name, email, roleId, password };
		setMessage(undefined);
		startTransition(async () => {
			const result: WorkerActionState = isNew
				? await createWorker(values)
				: await updateWorker(worker.id, values);
			if (result.ok) return onDone(isNew ? `Trabajador "${values.name}" creado.` : "Cambios guardados.");
			setMessage(result.message);
			const errors: WorkerFieldErrors = result.fieldErrors ?? {};
			form.setFields(
				(Object.keys(errors) as (keyof WorkerInput)[]).map((name) => ({ name, errors: [errors[name]!] })),
			);
		});
	}

	return (
		<Form
			form={form}
			layout="vertical"
			initialValues={
				worker
					? { name: worker.name, email: worker.email, roleId: worker.roleId }
					: { roleId: defaultRoleId }
			}
			onFinish={onFinish}
			disabled={pending}
			requiredMark="optional"
			autoComplete="off"
		>
			{message && <Alert type="error" title={message} showIcon style={{ marginBottom: 16 }} />}
			<Form.Item
				label="Nombre"
				name="name"
				rules={[{ required: true, whitespace: true, message: "El nombre es obligatorio." }]}
			>
				<Input placeholder="Nombre y apellido" maxLength={150} />
			</Form.Item>
			<Form.Item
				label="Correo"
				name="email"
				extra="Con este correo ingresará al sistema."
				rules={[
					{ required: true, whitespace: true, message: "El correo es obligatorio." },
					{ type: "email", message: "Correo inválido." },
				]}
			>
				<Input placeholder="trabajador@empresa.cl" maxLength={150} autoComplete="off" />
			</Form.Item>
			<Form.Item
				label="Rol"
				name="roleId"
				rules={[{ required: true, message: "Selecciona un rol." }]}
				extra={isSelf ? "No puedes quitarte el rol de administrador." : undefined}
			>
				<Select options={roleOptions} disabled={isSelf} />
			</Form.Item>
			<Form.Item
				label={isNew ? "Contraseña" : "Nueva contraseña"}
				name="password"
				extra={isNew ? undefined : "Déjala vacía para mantener la actual."}
				rules={[
					{ required: isNew, message: "La contraseña es obligatoria." },
					{
						min: PASSWORD_MIN,
						max: PASSWORD_MAX,
						message: `Entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`,
					},
				]}
			>
				<Input.Password maxLength={PASSWORD_MAX} autoComplete="new-password" />
			</Form.Item>
			<Form.Item
				label="Repetir contraseña"
				name="confirmPassword"
				dependencies={["password"]}
				rules={[
					({ getFieldValue }) => ({
						validator: (_, value?: string) =>
							(value ?? "") === (getFieldValue("password") ?? "")
								? Promise.resolve()
								: Promise.reject(new Error("Las contraseñas no coinciden.")),
					}),
				]}
			>
				<Input.Password maxLength={PASSWORD_MAX} autoComplete="new-password" />
			</Form.Item>
			<Flex gap="small" justify="end">
				<Button onClick={onCancel} disabled={pending}>
					Cancelar
				</Button>
				<Button type="primary" htmlType="submit" loading={pending}>
					{isNew ? "Crear trabajador" : "Guardar"}
				</Button>
			</Flex>
		</Form>
	);
}
