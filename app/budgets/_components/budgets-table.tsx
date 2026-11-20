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
	Tooltip,
	type TableColumnsType,
} from "antd";
import { BanIcon, FileDownIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExportButton } from "@/app/components/export-button";
import { annulBudget } from "@/lib/actions/budgets";
import { budgetPdfHref } from "@/lib/budgets/links";
import type { BudgetList, BudgetListItem } from "@/lib/budgets/queries";
import { BUDGET_STATUSES, type BudgetStatus } from "@/lib/budgets/status";
import { formatCLP, formatDate } from "@/lib/format";
import { AcceptButton } from "./accept-button";
import { SendBudgetButton } from "./send-budget-button";
import { SentTag } from "./sent-tag";

const statusOptions = [
	{ value: "", label: "Todos los estados" },
	...(Object.keys(BUDGET_STATUSES) as BudgetStatus[]).map((value) => ({
		value,
		label: BUDGET_STATUSES[value].label,
	})),
];

type BudgetsTableProps = {
	list: BudgetList;
	/** Sin correo de la empresa no se puede enviar (ver «Mi empresa»). */
	companyEmailMissing: boolean;
	isAdmin: boolean;
};

export function BudgetsTable({ list, companyEmailMissing, isAdmin }: BudgetsTableProps) {
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
			// Estado del presupuesto y, debajo, si ya se envió por correo.
			title: "Estado",
			key: "status",
			render: (_, item) => (
				<Flex vertical gap={4} align="flex-start">
					<Tag color={BUDGET_STATUSES[item.status].color}>{BUDGET_STATUSES[item.status].label}</Tag>
					{item.lastSent ? (
						<SentTag lastSent={item.lastSent} />
					) : (
						// En un anulado ya no se enviará: «No enviado» solo sería ruido.
						item.status !== "anulado" && <Tag>No enviado</Tag>
					)}
				</Flex>
			),
		},
		{
			title: "Acciones",
			key: "actions",
			align: "right",
			// 4 botones de 32 px + separación + relleno de la celda; fija a la
			// derecha para tenerla a mano al desplazar la tabla.
			width: 200,
			fixed: "right",
			render: (_, item) => (
				<Space size="small">
					<Tooltip title="Ver PDF">
						<Button
							href={budgetPdfHref(item.code)}
							target="_blank"
							rel="noopener"
							icon={<FileDownIcon size={16} aria-hidden />}
							aria-label={`Ver PDF de ${item.code}`}
						/>
					</Tooltip>
					{item.status !== "anulado" && (
						<SendBudgetButton
							compact
							code={item.code}
							clientEmail={item.clientEmail}
							companyEmailMissing={companyEmailMissing}
							isAdmin={isAdmin}
							lastSent={item.lastSent}
						/>
					)}
					{item.status !== "anulado" && (
						<AcceptButton compact code={item.code} accepted={item.status === "aceptado"} />
					)}
					{item.status !== "anulado" && (
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
					)}
				</Space>
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
				<ExportButton
					href="/budgets/export"
					params={{ q: list.search, status: list.status }}
					disabled={list.total === 0}
				/>
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
