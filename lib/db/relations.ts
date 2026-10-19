import { defineRelations } from "drizzle-orm";
import { roles, users } from "./schemas";

export const userRelations = defineRelations({ users, roles }, (r) => ({
	users: {
		role: r.one.roles({
			from: r.users.rolId,
			to: r.roles.id,
			optional: false,
		}),
	},
	roles: {
		users: r.many.users(),
	},
}));