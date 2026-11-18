/**
 * Fallback sin antd: los componentes de antd leen `Date.now()` al renderizar y
 * no pueden formar parte del prerender estático (Cache Components).
 */
export function LoadingFallback() {
	return (
		<p role="status" aria-live="polite" style={{ color: "rgba(0,0,0,0.45)" }}>
			Cargando…
		</p>
	);
}
