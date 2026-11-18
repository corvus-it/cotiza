"use client";

import { Card, Tabs } from "antd";
import { usePathname, useRouter } from "next/navigation";
import type { RoleOption, Worker } from "@/lib/company/queries";
import type { CompanyInput } from "@/lib/company/validation";
import { CompanyForm } from "./company-form";
import { WorkersTable } from "./workers-table";

type CompanySettingsProps = {
	tab: "data" | "workers";
	canEdit: boolean;
	currentUserId: number;
	company: CompanyInput;
	workers: Worker[];
	roles: RoleOption[];
};

export function CompanySettings({ tab, canEdit, currentUserId, company, workers, roles }: CompanySettingsProps) {
	const router = useRouter();
	const pathname = usePathname();

	return (
		<Card>
			<Tabs
				activeKey={tab}
				// La pestaña va en la URL para conservarla al recargar.
				onChange={(key) => router.replace(key === "workers" ? `${pathname}?tab=workers` : pathname, { scroll: false })}
				items={[
					{
						key: "data",
						label: "Datos de la empresa",
						children: <CompanyForm company={company} readOnly={!canEdit} />,
					},
					{
						key: "workers",
						label: `Trabajadores (${workers.filter((w) => w.active).length})`,
						children: (
							<WorkersTable
								workers={workers}
								roles={roles}
								currentUserId={currentUserId}
								readOnly={!canEdit}
							/>
						),
					},
				]}
			/>
		</Card>
	);
}
