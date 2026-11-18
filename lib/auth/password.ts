import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/*
 * Hash de contraseñas con scrypt (node:crypto, sin dependencias).
 * Formato guardado en `users.password_hash`: `scrypt$N$r$p$<salt b64>$<hash b64>`.
 * Los parámetros viajan con el hash para poder endurecerlos sin invalidar los antiguos.
 */

const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
	return new Promise((resolve, reject) =>
		scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...options, maxmem: 64 * 1024 * 1024 }, (error, key) =>
			error ? reject(error) : resolve(key),
		),
	);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_BYTES);
	const key = await derive(password, salt, PARAMS);
	return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

/** `true` si la contraseña coincide con el hash. Hashes con otro formato → `false`. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [scheme, n, r, p, salt, hash] = stored.split("$");
	if (scheme !== "scrypt" || !salt || !hash) return false;
	const expected = Buffer.from(hash, "base64");
	const key = await derive(password, Buffer.from(salt, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
	return key.length === expected.length && timingSafeEqual(key, expected);
}
