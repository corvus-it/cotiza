import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const clients = pgTable('clients', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
	rut: varchar('rut', { length: 20 }).notNull(),
	name: varchar('name', { length: 150 }).notNull(),
	email: varchar('email', { length: 150 }).notNull(),
	phone: varchar('phone', { length: 30 }).notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

