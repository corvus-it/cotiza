import { index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Sesiones de login. La cookie guarda un token aleatorio; aquí solo su hash
 * SHA-256 (`id`), así un volcado de la tabla no permite suplantar a nadie.
 * Ver .harness/sql/006_login_multiempresa.sql.
 */
export const sessions = pgTable(
	"sessions",
	{
		id: varchar("id", { length: 64 }).primaryKey(),
		userId: integer("user_id")
			.notNull()
			.references(() => users.id),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("sessions_user_id_idx").on(table.userId)],
);

export type Session = typeof sessions.$inferSelect;
