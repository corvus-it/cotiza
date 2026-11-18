import { BrandMark } from "@/app/components/app-shell";
import styles from "../login.module.css";

/** Lado de marca del login: el mismo grafito y amarillo de la barra lateral. */
export function LoginPanel() {
	return (
		<aside className={styles.brandSide}>
			<div className={styles.brand}>
				<BrandMark size={44} />
				<span className={styles.wordmark}>
					Corvus<span className={styles.wordmarkProduct}>Garage</span>
				</span>
			</div>
			<p className={styles.pitch}>Presupuestos, clientes y vehículos de tu taller, en un solo lugar.</p>
			<span className={styles.stripe} aria-hidden />
		</aside>
	);
}
