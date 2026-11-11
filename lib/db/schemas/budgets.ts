import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	index,
	integer,
	numeric,
	pgTable,
	text,
	varchar,
} from "drizzle-orm/pg-core";
import { clients } from "./clients";
import { users } from "./users";
import { vehicles } from "./vehicles";

/** Montos en CLP: numeric(14,2) leído como `number` (cabe sin pérdida). */
const amount = (name: string) =>
	numeric(name, { precision: 14, scale: 2, mode: "number" }).default(0).notNull();

/**
 * Mapeo de la tabla existente `budgets` (no se gestiona con drizzle-kit).
 * Nota: en la BD real NO existen FKs sobre client_id/vehicle_id/user_id; los
 * `.references()` solo documentan la relación (inocuos para lectura).
 * `code` y `budget_number` sí son UNIQUE en la BD.
 */
export const budgets = pgTable(
	"budgets",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		code: varchar("code", { length: 30 }).notNull().unique("budgets_code_key"),
		budgetNumber: integer("budget_number")
			.notNull()
			.unique("budgets_budget_number_key"),
		clientId: integer("client_id")
			.notNull()
			.references(() => clients.id),
		vehicleId: integer("vehicle_id")
			.notNull()
			.references(() => vehicles.id),
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
		// "date" es palabra reservada en SQL; Drizzle la cita al generar consultas.
		date: date("date").default(sql`CURRENT_DATE`).notNull(),
		validityDays: integer("validity_days").default(15).notNull(),
		diagnosis: text("diagnosis"),
		sparePartsAmount: amount("spare_parts_amount"),
		labourAmount: amount("labour_amount"),
		otherChargesAmount: amount("other_charges_amount"),
		discount: amount("discount"),
		netoAmount: amount("neto_amount"),
		ivaAmount: amount("iva_amount"),
		totalAmount: amount("total_amount"),
		estimatedDeliveryDate: date("estimated_delivery_date"),
		additionalObservations: text("additional_observations"),
		active: boolean().default(true).notNull(),
	},
	(table) => [
		index("idx_budgets_client_id").on(table.clientId),
		index("idx_budgets_vehicle_id").on(table.vehicleId),
		index("idx_budgets_user_id").on(table.userId),
		index("idx_budgets_date").on(table.date),
		check("budgets_validity_days_check", sql`${table.validityDays} > 0`),
		check("budgets_spare_parts_amount_check", sql`${table.sparePartsAmount} >= 0`),
		check("budgets_labour_amount_check", sql`${table.labourAmount} >= 0`),
		check("budgets_other_charges_amount_check", sql`${table.otherChargesAmount} >= 0`),
		check("budgets_discount_check", sql`${table.discount} >= 0`),
		check("budgets_neto_amount_check", sql`${table.netoAmount} >= 0`),
		check("budgets_iva_amount_check", sql`${table.ivaAmount} >= 0`),
		check("budgets_total_amount_check", sql`${table.totalAmount} >= 0`),
	],
);

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
