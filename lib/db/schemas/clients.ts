import { boolean, integer, pgTable, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { companies } from "./companies";

/**
 * Mapeo de la tabla existente `clients` (no se gestiona con drizzle-kit).
 * `rut` es UNIQUE por empresa (`clients_company_id_rut_key`) y se guarda normalizado
 * sin puntos y con guion (formato SII, p. ej. "12345678-5").
 * Borrado lógico: `active = false`.
 */
export const clients = pgTable(
	"clients",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		// Empresa dueña del registro. Ver .harness/sql/006_login_multiempresa.sql.
		companyId: integer("company_id")
			.notNull()
			.references(() => companies.id),
		rut: varchar("rut", { length: 20 }).notNull(),
		name: varchar("name", { length: 150 }).notNull(),
		email: varchar("email", { length: 150 }),
		phone: varchar("phone", { length: 30 }),
		active: boolean().default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [unique("clients_company_id_rut_key").on(table.companyId, table.rut)],
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
