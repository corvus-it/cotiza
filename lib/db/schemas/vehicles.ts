import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, smallint, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { companies } from "./companies";

/**
 * Mapeo de la tabla existente `vehicles` (no se gestiona con drizzle-kit).
 * `plate` es UNIQUE por empresa y se guarda normalizada (mayúsculas, sin
 * espacios ni guiones). Borrado lógico: `active = false`.
 */
export const vehicles = pgTable(
	"vehicles",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		// Empresa dueña del registro. Ver .harness/sql/006_login_multiempresa.sql.
		companyId: integer("company_id")
			.notNull()
			.references(() => companies.id),
		plate: varchar("plate", { length: 15 }).notNull(),
		brand: varchar("brand", { length: 80 }).notNull(),
		model: varchar("model", { length: 80 }).notNull(),
		year: smallint("year"),
		motor: varchar("motor", { length: 80 }),
		fuelType: varchar("fuel_type", { length: 30 }),
		mileage: integer("mileage"),
		active: boolean().default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		unique("vehicles_company_id_plate_key").on(table.companyId, table.plate),
		check("vehicles_year_check", sql`${table.year} >= 1900 AND ${table.year} <= 2100`),
		check("vehicles_mileage_check", sql`${table.mileage} >= 0`),
	],
);

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
