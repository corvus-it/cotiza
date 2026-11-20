import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { budgets } from "./budgets";
import { companies } from "./companies";
import { users } from "./users";

export const EMAIL_LOG_STATUSES = ["sent", "failed"] as const;
export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];

/**
 * Registro de correos enviados en nombre de cada empresa: una fila por intento.
 * Ver .harness/sql/007_email_logs.sql (no se gestiona con drizzle-kit).
 */
export const emailLogs = pgTable(
	"email_logs",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		companyId: integer("company_id")
			.notNull()
			.references(() => companies.id),
		userId: integer("user_id").references(() => users.id),
		budgetId: integer("budget_id").references(() => budgets.id),
		type: varchar("type", { length: 30 }).notNull(),
		toEmail: varchar("to_email", { length: 150 }).notNull(),
		subject: varchar("subject", { length: 255 }).notNull(),
		status: varchar("status", { length: 20, enum: EMAIL_LOG_STATUSES }).notNull(),
		providerId: varchar("provider_id", { length: 100 }),
		errorCode: varchar("error_code", { length: 30 }),
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("email_logs_company_id_created_at_idx").on(table.companyId, table.createdAt.desc()),
		index("email_logs_budget_id_idx").on(table.budgetId),
		check("email_logs_status_check", sql`${table.status} IN ('sent', 'failed')`),
	],
);

export type EmailLog = typeof emailLogs.$inferSelect;
export type NewEmailLog = typeof emailLogs.$inferInsert;
