"use client";

import { App, ConfigProvider, Drawer, type ThemeConfig } from "antd";
import esES from "antd/locale/es_ES";
import {
	Building2Icon,
	CarIcon,
	FileTextIcon,
	LayoutDashboardIcon,
	LogOutIcon,
	MenuIcon,
	PlusIcon,
	UsersIcon,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logout } from "@/lib/actions/auth";
import styles from "./app-shell.module.css";

export type ShellAccount = {
	userName: string;
	role: string;
	companyName: string | null;
};

type AppShellProps = {
	account: ShellAccount | null;
	children: ReactNode;
};

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
	{ href: "/", label: "Inicio", icon: LayoutDashboardIcon },
	{ href: "/budgets", label: "Presupuestos", icon: FileTextIcon },
	{ href: "/clients", label: "Clientes", icon: UsersIcon },
	{ href: "/vehicles", label: "Vehículos", icon: CarIcon },
];

const SETTINGS_ITEMS: NavItem[] = [{ href: "/company", label: "Mi empresa", icon: Building2Icon }];

const theme: ThemeConfig = {
	token: {
		colorPrimary: "#2364c4",
		colorInfo: "#2364c4",
		colorText: "#17202a",
		colorTextSecondary: "#5a6470",
		colorBorder: "#d3d9dd",
		// Mismo borde que los paneles (--line).
		colorBorderSecondary: "#dde2e5",
		colorBgLayout: "#f2f4f3",
		borderRadius: 8,
		borderRadiusLG: 12,
		fontFamily: "var(--font-sans)",
		fontSize: 14,
	},
	components: {
		Card: { headerFontSize: 19, headerFontSizeSM: 17 },
		Table: { headerBg: "#f6f7f7", headerColor: "#5a6470" },
		Segmented: { itemSelectedBg: "#ffffff" },
	},
};

function isActive(pathname: string, href: string): boolean {
	return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Placa del taller: rectángulo amarillo con perforación, como una ficha de llaves. */
export function BrandMark({ size = 32 }: { size?: number }) {
	return (
		<svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className={styles.mark}>
			<rect x="3" y="5" width="26" height="22" rx="5" fill="var(--signal)" />
			<circle cx="9.5" cy="16" r="2.4" fill="var(--graphite)" />
			<path d="M15 12.5h8M15 16h8M15 19.5h5" stroke="var(--graphite)" strokeWidth="2.2" strokeLinecap="round" />
		</svg>
	);
}

function Brand({ companyName }: { companyName: string | null }) {
	return (
		<Link href="/" className={styles.brand}>
			<BrandMark />
			<span className={styles.brandText}>
				{/* Familia Corvus: "Corvus" + el rubro, como CorvusBarber o CorvusCoffee. */}
				<span className={styles.wordmark}>
					Corvus<span className={styles.wordmarkProduct}>Garage</span>
				</span>
				<span className={styles.company}>{companyName ?? "Configura tu empresa"}</span>
			</span>
		</Link>
	);
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string }) {
	return (
		<ul className={styles.navList}>
			{items.map(({ href, label, icon: Icon }) => {
				const active = isActive(pathname, href);
				return (
					<li key={href}>
						<Link
							href={href}
							className={`${styles.navLink} ${active ? styles.active : ""}`}
							aria-current={active ? "page" : undefined}
						>
							<Icon size={18} strokeWidth={1.8} aria-hidden />
							{label}
						</Link>
					</li>
				);
			})}
		</ul>
	);
}

function Sidebar({ account, pathname }: { account: ShellAccount | null; pathname: string }) {
	return (
		<div className={styles.sidebarInner}>
			<Brand companyName={account?.companyName ?? null} />

			<Link href="/budgets/new-budget" className={styles.cta}>
				<PlusIcon size={18} strokeWidth={2.2} aria-hidden />
				Nuevo presupuesto
			</Link>

			<nav aria-label="Principal" className={styles.nav}>
				<NavList items={NAV_ITEMS} pathname={pathname} />
				<p className={styles.navGroup}>Configuración</p>
				<NavList items={SETTINGS_ITEMS} pathname={pathname} />
			</nav>

			{account && (
				<div className={styles.account}>
					<span className={styles.avatar} aria-hidden>
						{account.userName.trim().charAt(0).toUpperCase()}
					</span>
					<span className={styles.accountText}>
						<span className={styles.userName}>{account.userName}</span>
						<span className={styles.role}>{account.role}</span>
					</span>
					<form action={logout}>
						<button type="submit" className={styles.logout} aria-label="Cerrar sesión" title="Cerrar sesión">
							<LogOutIcon size={18} aria-hidden />
						</button>
					</form>
				</div>
			)}
		</div>
	);
}

export function AppShell({ account, children }: AppShellProps) {
	const pathname = usePathname();
	// El menú móvil queda abierto solo en la ruta donde se abrió: al navegar, se cierra.
	const [openOn, setOpenOn] = useState<string | null>(null);
	const drawerOpen = openOn === pathname;
	const setDrawerOpen = (open: boolean) => setOpenOn(open ? pathname : null);

	// Sin sesión (login): solo el tema, sin barra lateral.
	if (!account) {
		return (
			<ConfigProvider theme={theme} locale={esES}>
				<App>{children}</App>
			</ConfigProvider>
		);
	}

	return (
		<ConfigProvider theme={theme} locale={esES}>
			<App>
				<div className={styles.shell}>
					<aside className={styles.sidebar}>
						<Sidebar account={account} pathname={pathname} />
					</aside>

					<header className={styles.topbar}>
						<button
							type="button"
							className={styles.menuButton}
							onClick={() => setDrawerOpen(true)}
							aria-label="Abrir menú"
							aria-expanded={drawerOpen}
						>
							<MenuIcon size={22} aria-hidden />
						</button>
						<Brand companyName={account?.companyName ?? null} />
						<Link href="/budgets/new-budget" className={styles.topbarCta} aria-label="Nuevo presupuesto">
							<PlusIcon size={20} strokeWidth={2.2} aria-hidden />
						</Link>
					</header>

					<Drawer
						open={drawerOpen}
						onClose={() => setDrawerOpen(false)}
						placement="left"
						size={280}
						closable={false}
						styles={{ body: { padding: 0, background: "var(--graphite)" } }}
					>
						<Sidebar account={account} pathname={pathname} />
					</Drawer>

					<div className={styles.content}>{children}</div>
				</div>
			</App>
		</ConfigProvider>
	);
}
