"use client";

import { App, Button, Flex, Input, Popconfirm, Space, Table, Typography, type TableColumnsType } from "antd";
import { PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExportButton } from "@/app/components/export-button";
import { deleteVehicle } from "@/lib/actions/vehicles";
import type { VehicleWithClients } from "@/lib/vehicles/queries";

type VehiclesTableProps = {
	vehicles: VehicleWithClients[];
	query: string;
};

const km = new Intl.NumberFormat("es-CL");

export function VehiclesTable({ vehicles, query }: VehiclesTableProps) {
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

	function onDelete(vehicle: VehicleWithClients) {
		startDelete(async () => {
			const result = await deleteVehicle(vehicle.id);
			if (result.ok) message.success(`Vehículo ${vehicle.plate} eliminado.`);
			else message.error(result.message ?? "No se pudo eliminar el vehículo.");
		});
	}

	const columns: TableColumnsType<VehicleWithClients> = [
		{
			title: "Patente",
			dataIndex: "plate",
			width: 110,
			render: (plate: string) => <Typography.Text strong>{plate}</Typography.Text>,
		},
		{ title: "Marca", dataIndex: "brand" },
		{ title: "Modelo", dataIndex: "model" },
		{ title: "Año", dataIndex: "year", width: 80, render: (v: number | null) => v ?? "—" },
		{ title: "Combustible", dataIndex: "fuelType", render: (v: string | null) => v ?? "—" },
		{
			title: "Kilometraje",
			dataIndex: "mileage",
			align: "right",
			render: (v: number | null) => (v === null ? "—" : `${km.format(v)} km`),
		},
		{
			title: "Dueños",
			dataIndex: "clients",
			render: (owners: VehicleWithClients["clients"]) =>
				owners.length > 0 ? (
					<Flex vertical gap={2}>
						{owners.map((owner) => (
							<Link key={owner.id} href={`/clients/${owner.id}`}>
								{owner.name}
							</Link>
						))}
					</Flex>
				) : (
					<Typography.Text type="secondary">Sin asignar</Typography.Text>
				),
		},
		{
			title: "Acciones",
			key: "actions",
			align: "right",
			width: 120,
			render: (_, vehicle) => (
				<Space>
					<Link href={`/vehicles/${vehicle.id}`} aria-label={`Editar ${vehicle.plate}`}>
						<Button icon={<PencilIcon size={16} />} />
					</Link>
					<Popconfirm
						title="Eliminar vehículo"
						description={`¿Eliminar el vehículo ${vehicle.plate}?`}
						okText="Eliminar"
						cancelText="Cancelar"
						okButtonProps={{ danger: true }}
						onConfirm={() => onDelete(vehicle)}
					>
						<Button danger icon={<Trash2Icon size={16} />} aria-label={`Eliminar ${vehicle.plate}`} />
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
					placeholder="Buscar por patente, marca, modelo o dueño"
					allowClear
					loading={searching}
					onSearch={onSearch}
					style={{ maxWidth: 380 }}
				/>
				<ExportButton href="/vehicles/export" params={{ q: query }} disabled={vehicles.length === 0} />
			</Flex>
			<Table<VehicleWithClients>
				rowKey="id"
				columns={columns}
				dataSource={vehicles}
				loading={searching || deleting}
				pagination={{ pageSize: 20, hideOnSinglePage: true }}
				locale={{ emptyText: query ? "Sin resultados para la búsqueda." : "Aún no hay vehículos." }}
				scroll={{ x: 900 }}
			/>
		</Flex>
	);
}
