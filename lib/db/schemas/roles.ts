import { boolean, integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const roles = pgTable("roles", {

id:integer().primaryKey().generatedAlwaysAsIdentity(),
code: varchar('code',{ length:30 }).notNull(),
description: varchar('description', { length: 255 }).notNull(),
active: boolean().default(true).notNull()
})

export type Roles = typeof roles.$inferSelect;
export type NewRoles = typeof roles.$inferInsert;  





