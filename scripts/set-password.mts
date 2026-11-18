/*
 * Asigna una contraseña a un usuario existente (p. ej. el primer administrador,
 * que se creó por SQL con password_hash = 'sin-login').
 *
 *   node --env-file=.env --import tsx scripts/set-password.mts <correo> <contraseña>
 *
 * Usa el mismo formato de hash que lib/auth/password.ts y cierra las sesiones
 * abiertas de ese usuario.
 */
import { randomBytes, scrypt } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
	console.error("Uso: node --env-file=.env --import tsx scripts/set-password.mts <correo> <contraseña>");
	process.exit(1);
}
if (password.length < 8 || password.length > 72) {
	console.error("La contraseña debe tener entre 8 y 72 caracteres.");
	process.exit(1);
}
if (!process.env.DATABASE_URL) {
	console.error("Falta DATABASE_URL (usa --env-file=.env).");
	process.exit(1);
}

const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const salt = randomBytes(16);
const key = await new Promise<Buffer>((resolve, reject) =>
	scrypt(password.normalize("NFKC"), salt, 64, { ...PARAMS, maxmem: 64 * 1024 * 1024 }, (err, k) =>
		err ? reject(err) : resolve(k),
	),
);
const hash = ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
	update users set password_hash = ${hash}, updated_at = now()
	where email = ${email.trim().toLowerCase()}
	returning id, name, company_id`;

if (rows.length === 0) {
	console.error(`No existe un usuario con el correo ${email}.`);
	process.exit(1);
}
await sql`delete from sessions where user_id = ${rows[0].id}`;
const [user] = rows;
console.log(`Contraseña actualizada para ${user.name} (id ${user.id}).`);
if (user.company_id === null) console.warn("Ojo: el usuario no tiene empresa; no podrá ingresar hasta asignarle una.");
