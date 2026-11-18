import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessAlert } from "@/app/budgets/_components/access-alert";
import { LoadingFallback } from "@/app/components/loading-fallback";
import { Page } from "@/app/components/page-layout";
import { getBudgetAccess, todayCL } from "@/lib/budgets/queries";
import { isPeriodKey, resolvePeriod } from "@/lib/dashboard/period";
import { EXPIRING_DAYS, getDashboard } from "@/lib/dashboard/queries";
import { Dashboard } from "./_components/dashboard";

export const metadata: Metadata = { title: { absolute: "Inicio | CorvusGarage" } };

/** Nombre de pila, ignorando los valores de ejemplo del seed (`<<...>>`). */
function firstNameOf(name: string): string | null {
	if (/<<.*>>/.test(name)) return null;
	return name.trim().split(/\s+/)[0] || null;
}

export default function Home({ searchParams }: PageProps<"/">) {
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
