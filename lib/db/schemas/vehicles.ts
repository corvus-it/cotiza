import { boolean, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const vehicles = pgTable('vehicles', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
	plate: varchar('plate', { length: 15 }).notNull(),
	brand: varchar('brand', { length: 80 }).notNull(),
	model: varchar('model', { length: 80 }).notNull(),
	year: integer('year'),
	motor: varchar('motor', { length: 80 }).notNull(),
	fuelType: varchar('fuel_type', { length: 30 }).notNull(),
	mileage: integer('mileage'),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;