"use client";

import {
	App,
	Button,
	Empty,
	Flex,
	Input,
	Popconfirm,
	Select,
	Space,
	Table,
	Tag,
	type TableColumnsType,
} from "antd";
import { BanIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { annulBudget } from "@/lib/actions/budgets";
import type { BudgetList, BudgetListItem } from "@/lib/budgets/queries";
import { BUDGET_STATUSES, type BudgetStatus } from "@/lib/budgets/status";
import { formatCLP, formatDate } from "@/lib/format";

const statusOptions = [
	{ value: "", label: "Todos los estados" },
	...(Object.keys(BUDGET_STATUSES) as BudgetStatus[]).map((value) => ({
		value,
		label: BUDGET_STATUSES[value].label,
	})),
];

export function BudgetsTable({ list }: { list: BudgetList }) {
	const { message } = App.useApp();
	const router = useRouter();
	const pathname = usePathname();
	const [navigating, startNavigation] = useTransition();
	const [annulling, startAnnul] = useTransition();
	const hasFilters = Boolean(list.search || list.status);

	function navigate(params: { q?: string; status?: string | null; page?: number }) {
		const next = new URLSearchParams();
		const q = params.q ?? list.search;
		const status = params.status === undefined ? list.status : params.status;
		const page = params.page ?? 1;
		if (q) next.set("q", q);
		if (status) next.set("status", status);
		if (page > 1) next.set("page", String(page));
		const query = next.toString();
		startNavigation(() => router.replace(query ? `${pathname}?${query}` : pathname));
	}

	function onAnnul(item: BudgetListItem) {
		startAnnul(async () => {
			const result = await annulBudget(item.code);
			if (result.ok) message.success(`Presupuesto ${item.code} anulado.`);
			else message.error(result.message ?? "No se pudo anular el presupuesto.");
		});
	}

	const columns: TableColumnsType<BudgetListItem> = [
		{
			title: "Código",
			dataIndex: "code",
			fixed: "left",
			render: (code: string) => <Link href={`/budgets/${encodeURIComponent(code)}`}>{code}</Link>,
		},
		{ title: "N.º", dataIndex: "budgetNumber", align: "right" },
		{ title: "Fecha", dataIndex: "date", render: formatDate },
		{ title: "Vence", dataIndex: "expiresOn", render: formatDate },
		{ title: "Cliente", dataIndex: "clientName" },
		{
			title: "Vehículo",
			key: "vehicle",
			render: (_, item) => `${item.plate} · ${item.brand} ${item.model}`,
		},
		{ title: "Creado por", dataIndex: "userName" },
		{ title: "Neto", dataIndex: "netoAmount", align: "right", render: formatCLP },
		{ title: "IVA", dataIndex: "ivaAmount", align: "right", render: formatCLP },
		{
			title: "Total",
			dataIndex: "totalAmount",
			align: "right",
			render: (v: number) => <strong>{formatCLP(v)}</strong>,
		},
		{
			title: "Estado",
			dataIndex: "status",
			render: (status: BudgetStatus) => (
				<Tag color={BUDGET_STATUSES[status].color}>{BUDGET_STATUSES[status].label}</Tag>
			),
		},
		{
			title: "Acciones",
			key: "actions",
			align: "right",
			render: (_, item) =>
				item.status === "anulado" ? null : (
					<Popconfirm
						title="Anular presupuesto"
						description={`¿Anular el presupuesto ${item.code}? No se podrá modificar.`}
						okText="Anular"
						cancelText="Cancelar"
						okButtonProps={{ danger: true }}
						onConfirm={() => onAnnul(item)}
					>
						<Button danger icon={<BanIcon size={16} />} aria-label={`Anular ${item.code}`} />
					</Popconfirm>
				),
		},
	];

	return (
		<Flex vertical gap="middle">
			<Flex gap="small" justify="space-between" wrap>
				<Space wrap>
					<Select
						value={list.status ?? ""}
						options={statusOptions}
						onChange={(status) => navigate({ status: status || null })}
						style={{ width: 180 }}
						aria-label="Filtrar por estado"
					/>
					<Input.Search
						key={list.search}
						defaultValue={list.search}
						placeholder="Buscar por código, cliente o patente"
						allowClear
						loading={navigating}
						onSearch={(q) => navigate({ q: q.trim() })}
						style={{ width: 320, maxWidth: "100%" }}
					/>
				</Space>
			</Flex>
			<Table<BudgetListItem>
				rowKey="code"
				columns={columns}
				dataSource={list.items}
				loading={navigating || annulling}
				scroll={{ x: 1300 }}
				pagination={{
					current: list.page,
					pageSize: list.pageSize,
					total: list.total,
					showSizeChanger: false,
					hideOnSinglePage: true,
					showTotal: (total) => `${total} presupuesto${total === 1 ? "" : "s"}`,
					onChange: (page) => navigate({ page }),
				}}
				locale={{
					emptyText: hasFilters ? (
						<Empty description="Sin resultados para los filtros" />
					) : (
						<Empty description="Tu empresa aún no tiene presupuestos">
							<Link href="/budgets/new-budget">
								<Button type="primary">Crear el primero</Button>
							</Link>
						</Empty>
					),
				}}
			/>
		</Flex>
	);
}
