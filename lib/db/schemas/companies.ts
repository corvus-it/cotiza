import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	rut: varchar("rut", { length: 20 }).notNull().unique("companies_rut_key"),
	name: varchar("name", { length: 150 }).notNull(),
	// Giro comercial. Ver .harness/sql/005_mi_empresa.sql (columnas nuevas).
	businessActivity: varchar("business_activity", { length: 255 }),
	email: varchar("email", { length: 150 }),
	phone: varchar("phone", { length: 30 }),
	address: varchar("address", { length: 255 }),
	commune: varchar("commune", { length: 80 }),
	city: varchar("city", { length: 80 }),
	website: varchar("website", { length: 255 }),
	logo: varchar("logo", { length: 500 }),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
