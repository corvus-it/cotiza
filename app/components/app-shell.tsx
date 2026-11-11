"use client";
import { App, Layout, Menu } from "antd";
import { CarIcon, ChevronDownIcon, FileTextIcon, HouseIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const { Content, Header, Sider } = Layout;

type AppShellProps = {
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: <HouseIcon /> },
  { href: "/budgets", label: "Presupuestos", icon: <FileTextIcon /> },
  { href: "/clients", label: "Clientes", icon: <UserIcon /> },
  { href: "/vehicles", label: "Vehículos", icon: <CarIcon /> },
];

function getSelectedNavKey(pathname: string): string | undefined {
  if (pathname === "/") return "/";
  return NAV_ITEMS.find(
    ({ href }) =>
      href !== "/" && (pathname === href || pathname.startsWith(`${href}/`)),
  )?.href;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const selectedNavKey = getSelectedNavKey(pathname);

  return (
    <App>
    <Layout style={{ minHeight: "100vh" }}>
      <Header>
        <Menu
          theme="dark"
          mode="horizontal"
          itemIcon={<HouseIcon className="color-white" />}
          defaultSelectedKeys={["2"]}
          items={[
          ]}
          style={{ flex: 1, minWidth: 0 }}
        />
      </Header>
      <Layout hasSider>
        <Sider>
          <Menu
            mode="inline"
            selectedKeys={selectedNavKey ? [selectedNavKey] : []}
            style={{ height: "100%", borderInlineEnd: 0 }}
            items={NAV_ITEMS.map(({ href, label, icon }) => ({
              key: href,
              icon,
              label: <Link href={href}>{label}</Link>,
            }))}
          />
        </Sider>
        <Layout>
          <Content>{children}</Content>
        </Layout>
      </Layout>
    </Layout>
    </App>
  );
}
