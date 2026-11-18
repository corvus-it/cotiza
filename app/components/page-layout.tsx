import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import styles from "./page-layout.module.css";

/*
 * Estructura común de las páginas: contenedor, cabecera y panel.
 * Sin subcomponentes de antd (`X.Y`), así funciona en Server y Client Components.
 */

type PageProps = {
	/** Título de la página (h1). Si se omite, la página dibuja su propia cabecera. */
	title?: ReactNode;
	/** Una línea que explica para qué sirve la página. */
	description?: ReactNode;
	/** Enlace para volver al listado. */
	back?: { href: string; label: string };
	/** Junto al título: estado, número, etc. */
	meta?: ReactNode;
	/** A la derecha del título: la acción principal. */
	actions?: ReactNode;
	/** `narrow` para formularios. */
	width?: "full" | "narrow";
	children: ReactNode;
};

export function Page({ title, description, back, meta, actions, width = "full", children }: PageProps) {
	return (
		<main className={`${styles.page} ${width === "narrow" ? styles.narrow : ""}`}>
			{title !== undefined && (
				<PageHeader title={title} description={description} back={back} meta={meta} actions={actions} />
			)}
			{children}
		</main>
	);
}

export function PageHeader({ title, description, back, meta, actions }: Omit<PageProps, "children" | "width">) {
	return (
		<header className={styles.header}>
			{back && (
				<Link href={back.href} className={styles.back}>
					<ChevronLeftIcon size={16} aria-hidden />
					{back.label}
				</Link>
			)}
			<div className={styles.titleRow}>
				<div className={styles.titleBlock}>
					<div className={styles.titleLine}>
						<h1 className={styles.title}>{title}</h1>
						{meta}
					</div>
					{description && <p className={styles.description}>{description}</p>}
				</div>
				{actions && (
					<div className={styles.actions}>
						{/*
						 * Las acciones suelen ser botones de antd, que leen `Date.now()` al
						 * renderizar: con Cache Components no pueden ir en el prerender
						 * estático, así que se resuelven en cada petición.
						 */}
						<Suspense fallback={null}>{actions}</Suspense>
					</div>
				)}
			</div>
		</header>
	);
}

/** Superficie blanca con borde fino: la misma de los paneles del inicio. */
export function Panel({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
	return <section className={`${styles.panel} ${flush ? styles.flush : ""}`}>{children}</section>;
}
