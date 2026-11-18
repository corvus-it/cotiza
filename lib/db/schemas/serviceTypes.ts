import { boolean, integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const serviceTypes = pgTable("service_types", {
id:integer().primaryKey().generatedAlwaysAsIdentity(),
name: varchar('name',{ length:80 }).notNull().unique('service_types_name_key'),
active: boolean().default(true).notNull()
})

export type ServiceType = typeof serviceTypes.$inferSelect;
export type NewServiceType = typeof serviceTypes.$inferInsert;  





