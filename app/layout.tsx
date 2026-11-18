import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Suspense } from "react";
import { Shell } from "./components/shell";

// Barlow: sans de raíz señalética vial; la condensada para títulos y cifras.
const barlow = Barlow({
	variable: "--font-barlow",
	subsets: ["latin"],
	weight: ["400", "500", "600"],
});

const barlowCondensed = Barlow_Condensed({
	variable: "--font-barlow-condensed",
	subsets: ["latin"],
	weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
	title: { default: "CorvusGarage", template: "%s | CorvusGarage" },
	description: "Presupuestos, clientes y vehículos para talleres mecánicos.",
	applicationName: "CorvusGarage",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="es" className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}>
			<body className="min-h-full">
				<Suspense fallback={<main>{children}</main>}>
					<AntdRegistry>
						<Shell>{children}</Shell>
					</AntdRegistry>
				</Suspense>
			</body>
		</html>
	);
}
