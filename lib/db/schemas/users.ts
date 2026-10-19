import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	name: varchar("name", { length: 150 }).notNull(),
	email: varchar("email", { length: 150 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	rolId: integer("role_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert; 