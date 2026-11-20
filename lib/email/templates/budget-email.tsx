import { Body, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text } from "react-email";

/*
 * Correo que acompaña al PDF del presupuesto. Estilos en línea (los clientes
 * de correo ignoran CSS externo) y colores alineados con el PDF.
 */

export type BudgetEmailProps = {
	companyName: string;
	/** Solo URLs https: Gmail y otros bloquean imágenes http o data:. */
	companyLogo?: string | null;
	companyEmail?: string | null;
	companyPhone?: string | null;
	companyWebsite?: string | null;
	clientName: string;
	code: string;
	total: string;
	expiresOn: string;
	/** Mensaje opcional que escribe el usuario al enviar. */
	message?: string | null;
};

const INK = "#1f2328";
const MUTED = "#656d76";
const LINE = "#d0d7de";
const SOFT = "#f6f8fa";
const ACCENT = "#1f4e8c";

const font = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function BudgetEmail({
	companyName,
	companyLogo,
	companyEmail,
	companyPhone,
	companyWebsite,
	clientName,
	code,
	total,
	expiresOn,
	message,
}: BudgetEmailProps) {
	const logo = companyLogo?.startsWith("https://") ? companyLogo : null;
	const website = companyWebsite?.trim() || null;
	const websiteHref = website && !/^https?:\/\//.test(website) ? `https://${website}` : website;

	return (
		<Html lang="es">
			<Head />
			<Preview>{`Presupuesto ${code} de ${companyName} por ${total}`}</Preview>
			<Body style={{ backgroundColor: SOFT, fontFamily: font, color: INK, margin: 0, padding: "24px 0" }}>
				<Container
					style={{
						backgroundColor: "#ffffff",
						border: `1px solid ${LINE}`,
						borderRadius: 6,
						maxWidth: 560,
						padding: "28px 32px",
					}}
				>
					{logo && <Img src={logo} alt={companyName} height={48} style={{ marginBottom: 12 }} />}
					<Heading as="h1" style={{ fontSize: 20, margin: "0 0 4px", color: ACCENT }}>
						Presupuesto {code}
					</Heading>
					<Text style={{ fontSize: 14, color: MUTED, margin: "0 0 20px" }}>{companyName}</Text>

					<Text style={{ fontSize: 15, lineHeight: "22px" }}>Hola {clientName}:</Text>
					{message ? (
						<Text style={{ fontSize: 15, lineHeight: "22px", whiteSpace: "pre-line" }}>{message}</Text>
					) : (
						<Text style={{ fontSize: 15, lineHeight: "22px" }}>
							Te enviamos el presupuesto solicitado. Encontrarás el detalle completo en el PDF adjunto.
						</Text>
					)}

					<Section
						style={{
							backgroundColor: SOFT,
							border: `1px solid ${LINE}`,
							borderRadius: 4,
							padding: "12px 16px",
							margin: "20px 0",
						}}
					>
						<Text style={{ margin: 0, fontSize: 13, color: MUTED }}>Total</Text>
						<Text style={{ margin: "2px 0 8px", fontSize: 22, fontWeight: 700 }}>{total}</Text>
						<Text style={{ margin: 0, fontSize: 13, color: MUTED }}>Válido hasta el {expiresOn}</Text>
					</Section>

					<Text style={{ fontSize: 14, lineHeight: "21px" }}>
						Si tienes dudas o quieres aprobarlo, responde directamente a este correo.
					</Text>

					<Hr style={{ borderColor: LINE, margin: "24px 0 12px" }} />
					<Text style={{ fontSize: 12, color: MUTED, margin: 0, lineHeight: "18px" }}>
						{companyName}
						{companyPhone && ` · ${companyPhone}`}
						{companyEmail && (
							<>
								{" · "}
								<Link href={`mailto:${companyEmail}`} style={{ color: MUTED }}>
									{companyEmail}
								</Link>
							</>
						)}
						{website && websiteHref && (
							<>
								{" · "}
								<Link href={websiteHref} style={{ color: MUTED }}>
									{website}
								</Link>
							</>
						)}
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

/** Datos de ejemplo para `pnpm email:dev` (vista previa de React Email). */
BudgetEmail.PreviewProps = {
	companyName: "Taller Pérez",
	companyEmail: "contacto@tallerperez.cl",
	companyPhone: "+56 9 1234 5678",
	companyWebsite: "tallerperez.cl",
	clientName: "María González",
	code: "PRE-000123",
	total: "$245.990",
	expiresOn: "04-12-2026",
} satisfies BudgetEmailProps;

export default BudgetEmail;
