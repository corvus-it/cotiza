import { sql } from "drizzle-orm";
import { check, index, integer, numeric, pgTable, varchar } from "drizzle-orm/pg-core";
import { budgets } from "./budgets";
import { serviceTypes } from "./serviceTypes";

/**
 * Mapeo de la tabla existente `budget_details` (no se gestiona con drizzle-kit).
 * Nota: en la BD real NO existen FKs sobre budget_id/service_type_id; los
 * `.references()` solo documentan la relación (inocuos para lectura).
 */
export const budgetDetails = pgTable(
	"budget_details",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		budgetId: integer("budget_id")
			.notNull()
			.references(() => budgets.id),
		serviceTypeId: integer("service_type_id")
			.notNull()
			.references(() => serviceTypes.id),
		description: varchar("description", { length: 255 }).notNull(),
		quantity: numeric("quantity", { precision: 10, scale: 2, mode: "number" })
			.default(1)
			.notNull(),
		unitAmount: numeric("unit_amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
		// Columna generada (STORED) en la BD; nullable según information_schema.
		totalAmount: numeric("total_amount", {
			precision: 14,
			scale: 2,
			mode: "number",
		}).generatedAlwaysAs(sql`quantity * unit_amount`),
	},
	(table) => [
		index("idx_budget_details_budget_id").on(table.budgetId),
		index("idx_budget_details_service_type_id").on(table.serviceTypeId),
		check("budget_details_quantity_check", sql`${table.quantity} > 0`),
		check("budget_details_unit_amount_check", sql`${table.unitAmount} >= 0`),
	],
);

export type BudgetDetail = typeof budgetDetails.$inferSelect;
export type NewBudgetDetail = typeof budgetDetails.$inferInsert;
