"use client";

import { App, Button, Flex, Input, Popconfirm, Space, Table, type TableColumnsType } from "antd";
import { formatearRut } from "cotizacion-cl";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteClient } from "@/lib/actions/clients";

export type ClientRow = {
	id: number;
	rut: string;
	name: string;
	email: string | null;
	phone: string | null;
};

type ClientsTableProps = {
	clients: ClientRow[];
	query: string;
};

export function ClientsTable({ clients, query }: ClientsTableProps) {
	const { message } = App.useApp();
	const router = useRouter();
	const pathname = usePathname();
	const [searching, startSearch] = useTransition();
	const [deleting, startDelete] = useTransition();

	function onSearch(value: string) {
		const q = value.trim();
		startSearch(() => {
			router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
		});
	}

	function onDelete(client: ClientRow) {
		startDelete(async () => {
			const result = await deleteClient(client.id);
			if (result.ok) message.success(`Cliente "${client.name}" eliminado.`);
			else message.error(result.message ?? "No se pudo eliminar el cliente.");
		});
	}

	const columns: TableColumnsType<ClientRow> = [
		{ title: "RUT", dataIndex: "rut", render: (rut: string) => formatearRut(rut), width: 140 },
		{ title: "Nombre", dataIndex: "name" },
		{ title: "Correo", dataIndex: "email", render: (v: string | null) => v ?? "—" },
		{ title: "Teléfono", dataIndex: "phone", render: (v: string | null) => v ?? "—" },
		{
			title: "Acciones",
			key: "actions",
			align: "right",
			width: 120,
			render: (_, client) => (
				<Space>
					<Link href={`/clients/${client.id}`} aria-label={`Editar ${client.name}`}>
						<Button icon={<PencilIcon size={16} />} />
					</Link>
					<Popconfirm
						title="Eliminar cliente"
						description={`¿Eliminar a "${client.name}"?`}
						okText="Eliminar"
						cancelText="Cancelar"
						okButtonProps={{ danger: true }}
						onConfirm={() => onDelete(client)}
					>
						<Button
							danger
							icon={<Trash2Icon size={16} />}
							aria-label={`Eliminar ${client.name}`}
						/>
					</Popconfirm>
				</Space>
			),
		},
	];

	return (
		<Flex vertical gap="middle">
			<Flex gap="small" justify="space-between" wrap>
				<Input.Search
					key={query}
					defaultValue={query}
					placeholder="Buscar por RUT, nombre o correo"
					allowClear
					loading={searching}
					onSearch={onSearch}
					style={{ maxWidth: 360 }}
				/>
				<Link href="/clients/new-client">
					<Button type="primary" icon={<PlusIcon size={16} />}>
						Nuevo cliente
					</Button>
				</Link>
			</Flex>
			<Table<ClientRow>
				rowKey="id"
				columns={columns}
				dataSource={clients}
				loading={searching || deleting}
				pagination={{ pageSize: 20, hideOnSinglePage: true }}
				locale={{ emptyText: query ? "Sin resultados para la búsqueda." : "Aún no hay clientes." }}
				scroll={{ x: 720 }}
			/>
		</Flex>
	);
}
