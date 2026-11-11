import { defineRelations } from "drizzle-orm";
import * as schema from "./schemas";

/**
 * Relaciones (v2) de todas las tablas de `lib/db/schemas`.
 * Incluye users ↔ companies (T-002) y budgets / budget_details (T-003).
 */
export const relations = defineRelations(schema, (r) => ({
	users: {
		role: r.one.roles({
			from: r.users.rolId,
			to: r.roles.id,
			optional: false,
		}),
		// company_id es nullable → relación opcional (null = "sin empresa").
		company: r.one.companies({
			from: r.users.companyId,
			to: r.companies.id,
		}),
		budgets: r.many.budgets(),
	},
	roles: {
		users: r.many.users(),
	},
	companies: {
		users: r.many.users(),
	},
	clients: {
		budgets: r.many.budgets(),
	},
	vehicles: {
		budgets: r.many.budgets(),
	},
	serviceTypes: {
		budgetDetails: r.many.budgetDetails(),
	},
	budgets: {
		client: r.one.clients({
			from: r.budgets.clientId,
			to: r.clients.id,
			optional: false,
		}),
		vehicle: r.one.vehicles({
			from: r.budgets.vehicleId,
			to: r.vehicles.id,
			optional: false,
		}),
		user: r.one.users({
			from: r.budgets.userId,
			to: r.users.id,
			optional: false,
		}),
		details: r.many.budgetDetails(),
	},
	budgetDetails: {
		budget: r.one.budgets({
			from: r.budgetDetails.budgetId,
			to: r.budgets.id,
			optional: false,
		}),
		serviceType: r.one.serviceTypes({
			from: r.budgetDetails.serviceTypeId,
			to: r.serviceTypes.id,
			optional: false,
		}),
	},
}));
