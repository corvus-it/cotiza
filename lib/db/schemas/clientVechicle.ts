import { index, integer, pgTable, unique } from "drizzle-orm/pg-core";
import { clients } from "./clients";
import { vehicles } from "./vehicles";

/**
 * Mapeo de la tabla existente `client_vehicles` (asignación vehículo ↔ cliente).
 * Sin FKs en la BD: los `.references()` solo documentan la relación.
 * La app usa a lo sumo un cliente por vehículo (ver `lib/actions/vehicles.ts`).
 */
export const clientVehicles = pgTable(
	"client_vehicles",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		clientId: integer("client_id")
			.notNull()
			.references(() => clients.id),
		vehicleId: integer("vehicle_id")
			.notNull()
			.references(() => vehicles.id),
	},
	(table) => [
		unique("client_vehicles_client_id_vehicle_id_key").on(table.clientId, table.vehicleId),
		index("idx_client_vehicles_vehicle_id").on(table.vehicleId),
	],
);

export type ClientVehicle = typeof clientVehicles.$inferSelect;
export type NewClientVehicle = typeof clientVehicles.$inferInsert;
