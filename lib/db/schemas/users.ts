import { boolean, index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { companies } from "./companies";

export const users = pgTable(
	"users",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		name: varchar("name", { length: 150 }).notNull(),
		email: varchar("email", { length: 150 }).notNull(),
		passwordHash: varchar("password_hash", { length: 255 }).notNull(),
		rolId: integer("role_id").notNull(),
		// Nullable: ver .harness/sql/001_users_company_id.sql (null = "sin empresa").
		companyId: integer("company_id").references(() => companies.id),
		active: boolean().default(true).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("users_company_id_idx").on(table.companyId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
