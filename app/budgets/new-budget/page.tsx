import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingFallback } from "@/app/components/loading-fallback";
import { Page } from "@/app/components/page-layout";
import { createBudget } from "@/lib/actions/budgets";
import {
	getBudgetAccess,
	listBudgetVehicles,
	listServiceTypes,
	todayCL,
} from "@/lib/budgets/queries";
import { listClientOptions } from "@/lib/clients/queries";
import { AccessAlert } from "../_components/access-alert";
import { BudgetForm } from "../_components/budget-form";

export const metadata: Metadata = { title: "Nuevo presupuesto" };

export default function NewBudgetPage() {
	return (
		<Page
			title="Nuevo presupuesto"
			description="Si el cliente o el vehículo aún no existen, créalos desde aquí con «Nuevo»."
			back={{ href: "/budgets", label: "Presupuestos" }}
		>
			<Suspense fallback={<LoadingFallback />}>
				<NewBudget />
			</Suspense>
		</Page>
	);
}

async function NewBudget() {
	const access = await getBudgetAccess();
	if (!access.ok) return <AccessAlert reason={access.reason} />;

	const [clients, vehicles, serviceTypes, today] = await Promise.all([
		listClientOptions(),
		listBudgetVehicles(),
		listServiceTypes(),
		todayCL(),
	]);

	return (
		<BudgetForm
			submitLabel="Crear presupuesto"
			clients={clients}
			vehicles={vehicles}
			serviceTypes={serviceTypes}
			initialValues={{ date: today, validityDays: 15 }}
			action={createBudget}
		/>
	);
}
