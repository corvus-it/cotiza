import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessAlert } from "@/app/budgets/_components/access-alert";
import { LoadingFallback } from "@/app/components/loading-fallback";
import { Page } from "@/app/components/page-layout";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBudgetAccess, todayCL } from "@/lib/budgets/queries";
import { isPeriodKey, resolvePeriod } from "@/lib/dashboard/period";
import { EXPIRING_DAYS, getDashboard } from "@/lib/dashboard/queries";
import { getContact } from "@/lib/marketing";
import { Dashboard } from "./_components/dashboard";
import { Landing } from "./_components/landing";

export const metadata: Metadata = {
	title: { absolute: "CorvusGarage | Presupuestos para talleres mecánicos" },
	description:
		"Presupuestos de taller con IVA calculado, clientes y vehículos por patente y aviso de presupuestos por vencer. Desde $15.000 + IVA al mes.",
};

/** Nombre de pila, ignorando los valores de ejemplo del seed (`<<...>>`). */
function firstNameOf(name: string): string | null {
	if (/<<.*>>/.test(name)) return null;
	return name.trim().split(/\s+/)[0] || null;
}

/**
 * `/`: sin sesión, la página de venta; con sesión, el panel del taller.
 * La sesión se lee en la petición, por eso va dentro de un `Suspense`.
 */
export default function Home({ searchParams }: PageProps<"/">) {
	return (
		<Suspense fallback={null}>
			<HomeSwitch searchParams={searchParams} />
		</Suspense>
	);
}

async function HomeSwitch({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
	const user = await getCurrentUser();
	if (user?.companyId == null) return <Landing contact={getContact()} />;

	return (
		<Page>
			<Suspense fallback={<LoadingFallback />}>
				<HomeContent searchParams={searchParams} />
			</Suspense>
		</Page>
	);
}

async function HomeContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
	const [{ periodo }, access, today] = await Promise.all([searchParams, getBudgetAccess(), todayCL()]);
	if (!access.ok) return <AccessAlert reason={access.reason} />;

	const period = resolvePeriod(isPeriodKey(periodo) ? periodo : "mes", today);
	const data = await getDashboard(access.company.id, period);

	return (
		<Dashboard
			data={data}
			period={period}
			expiringDays={EXPIRING_DAYS}
			firstName={firstNameOf(access.user.name)}
		/>
	);
}
