import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Mapeo de la tabla existente `clients` (no se gestiona con drizzle-kit).
 * `rut` es UNIQUE en la BD (`clients_rut_key`) y se guarda normalizado
 * sin puntos y con guion (formato SII, p. ej. "12345678-5").
 * Borrado lógico: `active = false`.
 */
export const clients = pgTable("clients", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	rut: varchar("rut", { length: 20 }).notNull().unique("clients_rut_key"),
	name: varchar("name", { length: 150 }).notNull(),
	email: varchar("email", { length: 150 }),
	phone: varchar("phone", { length: 30 }),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
