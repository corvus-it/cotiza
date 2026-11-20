"use client";

import { Button } from "antd";
import { SheetIcon } from "lucide-react";

type ExportButtonProps = {
	/** Ruta de exportación, p. ej. `/clients/export`. */
	href: string;
	/** Filtros activos del listado (los vacíos se omiten). */
	params?: Record<string, string | null | undefined>;
	disabled?: boolean;
};

/** Descarga el listado en Excel (.xlsx) con los mismos filtros que se ven en pantalla. */
export function ExportButton({ href, params = {}, disabled }: ExportButtonProps) {
	const query = new URLSearchParams(
		Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
	).toString();
	return (
		<Button
			href={query ? `${href}?${query}` : href}
			download
			disabled={disabled}
			icon={<SheetIcon size={16} aria-hidden />}
		>
			Exportar a Excel
		</Button>
	);
}
