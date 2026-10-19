import { integer, pgTable } from "drizzle-orm/pg-core";

export const clientVehicles = pgTable('client_vehicles', {
id: integer().primaryKey().generatedAlwaysAsIdentity(),
clientId: integer('client_id').notNull(),
vehicleId: integer('vehicle_id').notNull(),
});

export type ClientVehicle = typeof clientVehicles.$inferSelect;
export type NewClientVehicle = typeof clientVehicles.$inferInsert;

