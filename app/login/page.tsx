import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LoginForm } from "./_components/login-form";
import { LoginPanel } from "./_components/login-panel";
import styles from "./login.module.css";

export const metadata: Metadata = { title: { absolute: "Ingresar | CorvusGarage" } };

const ERRORS: Record<string, string> = {
	"sin-empresa": "Tu usuario no tiene una empresa asignada. Pide a un administrador que te agregue.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
	return (
		<main className={styles.page}>
			<LoginPanel />
			<section className={styles.formSide}>
				<Suspense fallback={null}>
					<Login searchParams={searchParams} />
				</Suspense>
			</section>
		</main>
	);
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
	const [{ next, error }, user] = await Promise.all([searchParams, getCurrentUser()]);
	// Con sesión válida no tiene sentido mostrar el login.
	if (user?.companyId != null) redirect("/");

	return (
		<LoginForm
			next={typeof next === "string" ? next : undefined}
			notice={typeof error === "string" ? ERRORS[error] : undefined}
		/>
	);
}
