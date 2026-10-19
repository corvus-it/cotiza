import { integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const companies = pgTable('companies', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
	rut: varchar('rut', { length: 20 }).notNull(),
	name: varchar('name', { length: 150 }).notNull(),
	email: varchar('email', { length: 150 }),
	phone: varchar('phone', { length: 30 }),
	address: varchar('address', { length: 255 }),
	logo: varchar('logo', { length: 500 }),
});

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

