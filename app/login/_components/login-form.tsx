"use client";

import { Alert, Button, Form, Input } from "antd";
import { useState, useTransition } from "react";
import { login } from "@/lib/actions/auth";
import styles from "../login.module.css";

type LoginValues = { email: string; password: string };

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string>();

	function onFinish(values: LoginValues) {
		setError(undefined);
		startTransition(async () => {
			// Si es correcto, la acción redirige; solo vuelve con un error.
			const result = await login({ ...values, next });
			if (!result.ok) setError(result.message);
		});
	}

	return (
		<div className={styles.formBox}>
			<h1 className={styles.title}>Ingresa a tu taller</h1>
			<p className={styles.subtitle}>Usa el correo y la contraseña que te dio el administrador de tu empresa.</p>

			{(error ?? notice) && (
				<Alert type={error ? "error" : "warning"} title={error ?? notice} showIcon style={{ marginBottom: 20 }} />
			)}

			<Form<LoginValues> layout="vertical" onFinish={onFinish} disabled={pending} requiredMark={false} size="large">
				<Form.Item
					label="Correo"
					name="email"
					rules={[
						{ required: true, whitespace: true, message: "Ingresa tu correo." },
						{ type: "email", message: "Correo inválido." },
					]}
				>
					<Input autoComplete="email" inputMode="email" autoFocus placeholder="nombre@taller.cl" />
				</Form.Item>
				<Form.Item label="Contraseña" name="password" rules={[{ required: true, message: "Ingresa tu contraseña." }]}>
					<Input.Password autoComplete="current-password" />
				</Form.Item>
				<Button type="primary" htmlType="submit" block loading={pending}>
					Ingresar
				</Button>
			</Form>

			<p className={styles.help}>¿Olvidaste tu contraseña? Pídele a un administrador que te asigne una nueva en «Mi empresa».</p>
		</div>
	);
}
