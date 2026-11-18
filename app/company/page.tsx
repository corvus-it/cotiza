import { Alert } from "antd";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessAlert } from "@/app/budgets/_components/access-alert";
import { LoadingFallback } from "@/app/components/loading-fallback";
import { Page } from "@/app/components/page-layout";
import { getCompanyAccess, listRoleOptions, listWorkers } from "@/lib/company/queries";
import { CompanySettings } from "./_components/company-settings";

export const metadata: Metadata = { title: "Mi empresa" };

export default function CompanyPage({ searchParams }: PageProps<"/company">) {
	return (
		<Page
			title="Mi empresa"
			description="Los datos de la empresa salen en cada presupuesto. Aquí también gestionas quién puede ingresar."
		>
			<Suspense fallback={<LoadingFallback />}>
				<Company searchParams={searchParams} />
			</Suspense>
		</Page>
	);
}

async function Company({ searchParams }: Pick<PageProps<"/company">, "searchParams">) {
	const access = await getCompanyAccess();
	if (!access.ok) return <AccessAlert reason={access.reason} />;

	const [{ tab }, workers, roles] = await Promise.all([
		searchParams,
		listWorkers(access.company.id),
		listRoleOptions(),
	]);
	const { company } = access;

	return (
		<>
			{!access.isAdmin && (
				<Alert
					type="info"
					showIcon
					style={{ marginBottom: 16 }}
					title="Solo lectura"
					description="Solo un administrador puede modificar los datos de la empresa y sus trabajadores."
				/>
			)}
			<CompanySettings
				tab={tab === "workers" ? "workers" : "data"}
				canEdit={access.isAdmin}
				currentUserId={access.user.id}
				company={{
					rut: company.rut,
					name: company.name,
					businessActivity: company.businessActivity,
					address: company.address,
					commune: company.commune,
					city: company.city,
					email: company.email,
					phone: company.phone,
					website: company.website,
					logo: company.logo,
				}}
				workers={workers}
				roles={roles}
			/>
		</>
	);
}
