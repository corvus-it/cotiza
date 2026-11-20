import { Button } from "antd";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingFallback } from "@/app/components/loading-fallback";
import { Page, Panel } from "@/app/components/page-layout";
import { getBudgetAccess, getCompanyBudgets } from "@/lib/budgets/queries";
import { ADMIN_ROLE } from "@/lib/company/validation";
import { AccessAlert } from "./_components/access-alert";
import { BudgetsTable } from "./_components/budgets-table";

export const metadata: Metadata = { title: "Presupuestos" };

export default function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
	return (
		<Page
			title="Presupuestos"
			description="Todos los presupuestos de tu empresa. Filtra por estado o busca por código, cliente o patente."
			actions={
				<Link href="/budgets/new-budget">
					<Button type="primary" icon={<PlusIcon size={16} />}>
						Nuevo presupuesto
					</Button>
				</Link>
			}
		>
			<Panel>
				<Suspense fallback={<LoadingFallback />}>
					<BudgetsList searchParams={searchParams} />
				</Suspense>
			</Panel>
		</Page>
	);
}

async function BudgetsList({ searchParams }: Pick<PageProps<"/budgets">, "searchParams">) {
	const [{ q, status, page }, access] = await Promise.all([searchParams, getBudgetAccess()]);
	if (!access.ok) return <AccessAlert reason={access.reason} />;

	const list = await getCompanyBudgets(access.company.id, { search: q, status, page });
	return (
		<BudgetsTable
			list={list}
			companyEmailMissing={!access.company.email?.trim()}
			isAdmin={access.user.roleCode === ADMIN_ROLE}
		/>
	);
}
