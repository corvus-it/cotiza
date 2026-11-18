import { Alert, Flex } from "antd";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LoadingFallback } from "@/app/components/loading-fallback";
import { Page } from "@/app/components/page-layout";
import { updateBudget } from "@/lib/actions/budgets";
import {
	getBudgetAccess,
	getCompanyBudget,
	listBudgetVehicles,
	listServiceTypes,
} from "@/lib/budgets/queries";
import { listClientOptions } from "@/lib/clients/queries";
import { AccessAlert } from "../_components/access-alert";
import { AnnulButton } from "../_components/annul-button";
import { BudgetHeader } from "../_components/budget-header";
import { BudgetForm } from "../_components/budget-form";

export const metadata: Metadata = { title: "Presupuesto" };

export default function BudgetPage({ params }: PageProps<"/budgets/[budgetCode]">) {
	return (
		<Page>
			<Suspense fallback={<LoadingFallback />}>
				<Budget params={params} />
			</Suspense>
		</Page>
	);
}

async function Budget({ params }: Pick<PageProps<"/budgets/[budgetCode]">, "params">) {
	const [{ budgetCode }, access] = await Promise.all([params, getBudgetAccess()]);
	if (!access.ok) return <AccessAlert reason={access.reason} />;

	const budget = await getCompanyBudget(access.company.id, budgetCode);
	if (!budget) notFound();

	const [clients, vehicles, serviceTypes] = await Promise.all([
		listClientOptions(),
		listBudgetVehicles(),
		listServiceTypes(budget.lines.map((l) => l.serviceTypeId)),
	]);

	// Cliente o vehículo eliminados después de emitir: se muestran igual.
	if (!clients.some((c) => c.id === budget.clientId))
		clients.push({ id: budget.clientId, name: `${budget.clientName} (eliminado)`, rut: budget.clientRut });
	if (!vehicles.some((v) => v.id === budget.vehicleId))
		vehicles.push({
			id: budget.vehicleId,
			plate: `${budget.plate} (eliminado)`,
			brand: budget.brand,
			model: budget.model,
			ownerIds: [],
		});

	const readOnly = budget.status === "anulado";

	return (
		<Flex vertical gap="middle">
			<BudgetHeader
				code={budget.code}
				budgetNumber={budget.budgetNumber}
				status={budget.status}
				userName={budget.userName}
				expiresOn={budget.expiresOn}
			/>
			{readOnly && (
				<Alert type="info" showIcon title="Este presupuesto está anulado y no se puede modificar." />
			)}
			<BudgetForm
				submitLabel="Guardar cambios"
				clients={clients}
				vehicles={vehicles}
				serviceTypes={serviceTypes}
				readOnly={readOnly}
				extraActions={readOnly ? undefined : <AnnulButton code={budget.code} />}
				action={updateBudget.bind(null, budget.code)}
				initialValues={{
					clientId: budget.clientId,
					vehicleId: budget.vehicleId,
					date: budget.date,
					validityDays: budget.validityDays,
					estimatedDeliveryDate: budget.estimatedDeliveryDate,
					diagnosis: budget.diagnosis,
					additionalObservations: budget.additionalObservations,
					discount: budget.discount,
					lines: budget.lines,
				}}
			/>
		</Flex>
	);
}
