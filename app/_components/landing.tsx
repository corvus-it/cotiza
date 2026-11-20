import {
	BellRingIcon,
	CalculatorIcon,
	CarIcon,
	CheckIcon,
	LayoutDashboardIcon,
	MinusIcon,
	ShieldCheckIcon,
	UsersIcon,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/app/components/app-shell";
import { formatCLP } from "@/lib/format";
import { contactHref, PLAN_COMPARISON, PLANS, withIva, type Contact } from "@/lib/marketing";
import styles from "./landing.module.css";

/*
 * Página pública de CorvusGarage (sin sesión). Server Component sin antd:
 * todo el contenido es estático y se dibuja con HTML y CSS propios.
 */

type Feature = { icon: LucideIcon; title: string; text: string };

const FEATURES: Feature[] = [
	{
		icon: CalculatorIcon,
		title: "Presupuestos con el IVA ya calculado",
		text: "Separa repuestos, mano de obra y otros cargos, aplica descuentos y obtén neto, IVA y total al instante. Cada presupuesto lleva su número propio, su fecha de validez y los datos de tu empresa.",
	},
	{
		icon: CarIcon,
		title: "Clientes y vehículos por patente",
		text: "Busca por RUT, nombre o patente. Si el cliente o el auto aún no existen, créalos sin salir del presupuesto.",
	},
	{
		icon: BellRingIcon,
		title: "Sabes qué está por vencer",
		text: "El inicio te muestra los presupuestos que caducan en los próximos 7 días, para llamar al cliente a tiempo.",
	},
	{
		icon: LayoutDashboardIcon,
		title: "Cómo va el mes, de un vistazo",
		text: "Cuánto llevas presupuestado, comparado con el mes anterior, qué servicios mueven más plata y quiénes son tus mejores clientes.",
	},
	{
		icon: UsersIcon,
		title: "Tu equipo con su propio acceso",
		text: "Cada trabajador entra con su correo. Si alguien deja el taller, lo desactivas y pierde el acceso al instante.",
	},
	{
		icon: ShieldCheckIcon,
		title: "Tus datos son solo tuyos",
		text: "Cada taller ve únicamente sus clientes, vehículos y presupuestos. Funciona en el navegador del computador o del celular, sin instalar nada.",
	},
];

const STEPS = [
	{ title: "Registra al cliente y su vehículo", text: "Con RUT y patente. O hazlo en el mismo presupuesto." },
	{ title: "Agrega repuestos y mano de obra", text: "El neto, el IVA y el total se calculan solos." },
	{ title: "Envíalo y haz seguimiento", text: "Te avisamos cuáles están por vencer para que no se te pase ninguno." },
];

const FAQ = [
	{
		q: "¿Tengo que instalar algo?",
		a: "No. CorvusGarage funciona en el navegador, desde el computador del taller o desde el celular.",
	},
	{
		q: "¿Los precios incluyen IVA?",
		a: `No. ${PLANS.map((p) => `El plan ${p.name} cuesta ${formatCLP(p.price)} + IVA (${formatCLP(withIva(p.price))} al mes)`).join(" y ")}.`.replace(" y El ", " y el "),
	},
	{
		q: "¿Otros talleres pueden ver mis clientes?",
		a: "No. Cada taller tiene su propio espacio: sus clientes, vehículos, presupuestos y trabajadores no se mezclan con los de nadie más.",
	},
	{
		q: "¿Quién puede entrar a mi cuenta?",
		a: "Solo las personas que tú agregues como trabajadores. Los administradores pueden crear, editar y desactivar accesos.",
	},
];

/** Presupuesto de ejemplo del hero: el producto mostrado tal como se ve. */
const SAMPLE = {
	code: "PRE-000124",
	client: "Transportes Lagos SpA",
	vehicle: "Toyota Hilux 2019",
	plate: "KJTR52",
	lines: [
		{ category: "Repuesto", description: "Pastillas de freno delanteras", quantity: 2, unit: 28_900 },
		{ category: "Mano de obra", description: "Cambio de pastillas", quantity: 1, unit: 35_000 },
		{ category: "Mano de obra", description: "Rectificado de discos", quantity: 1, unit: 30_000 },
	],
};

function SampleBudget() {
	const neto = SAMPLE.lines.reduce((sum, l) => sum + l.quantity * l.unit, 0);
	const iva = Math.round(neto * 0.19);
	return (
		<figure className={styles.sample} aria-label="Ejemplo de presupuesto en CorvusGarage">
			<div className={styles.sampleHead}>
				<div>
					<p className={styles.sampleCode}>Presupuesto {SAMPLE.code}</p>
					<p className={styles.sampleMeta}>
						{SAMPLE.client}
						<br />
						{SAMPLE.vehicle}, patente {SAMPLE.plate}
					</p>
				</div>
				<span className={styles.sampleTag}>Vence en 3 días</span>
			</div>
			<table className={styles.sampleTable}>
				<thead>
					<tr>
						<th scope="col">Detalle</th>
						<th scope="col" className={styles.num}>
							Cant.
						</th>
						<th scope="col" className={styles.num}>
							Monto
						</th>
					</tr>
				</thead>
				<tbody>
					{SAMPLE.lines.map((line) => (
						<tr key={line.description}>
							<td>
								{line.description}
								<span className={styles.sampleCategory}>{line.category}</span>
							</td>
							<td className={styles.num}>{line.quantity}</td>
							<td className={styles.num}>{formatCLP(line.quantity * line.unit)}</td>
						</tr>
					))}
				</tbody>
			</table>
			<dl className={styles.sampleTotals}>
				<div>
					<dt>Neto</dt>
					<dd>{formatCLP(neto)}</dd>
				</div>
				<div>
					<dt>IVA (19 %)</dt>
					<dd>{formatCLP(iva)}</dd>
				</div>
				<div className={styles.sampleTotal}>
					<dt>Total</dt>
					<dd>{formatCLP(neto + iva)}</dd>
				</div>
			</dl>
		</figure>
	);
}

function Cell({ value }: { value: boolean | string }) {
	if (value === true) return <CheckIcon size={18} aria-label="Incluido" className={styles.yes} />;
	if (value === false) return <MinusIcon size={18} aria-label="No incluido" className={styles.no} />;
	return <>{value}</>;
}

export function Landing({ contact }: { contact: Contact }) {
	const hasContact = Boolean(contact.whatsapp || contact.email);
	const trialHref = contactHref(contact, "Hola, quiero conocer CorvusGarage para mi taller.");

	return (
		<div className={styles.root}>
			<header className={styles.nav}>
				<Link href="/" className={styles.brand}>
					<BrandMark size={30} />
					<span className={styles.wordmark}>
						Corvus<span className={styles.wordmarkProduct}>Garage</span>
					</span>
				</Link>
				<nav aria-label="Secciones" className={styles.navLinks}>
					<a href="#funciones">Qué hace</a>
					<a href="#planes">Planes</a>
					<a href="#preguntas">Preguntas</a>
				</nav>
				<Link href="/login" className={styles.navLogin}>
					Ingresar
				</Link>
			</header>

			<main>
				<section className={styles.hero}>
					<div className={styles.heroText}>
						<h1 className={styles.headline}>Del diagnóstico al presupuesto en minutos.</h1>
						<p className={styles.lead}>
							CorvusGarage arma los presupuestos de tu taller con repuestos, mano de obra e IVA, guarda a tus
							clientes y sus vehículos por patente, y te avisa qué presupuestos están por vencer.
						</p>
						<div className={styles.heroActions}>
							<a href="#planes" className={styles.primary}>
								Ver planes
							</a>
							{hasContact && (
								<a href={trialHref} className={styles.secondary} target="_blank" rel="noreferrer">
									Hablar con nosotros
								</a>
							)}
						</div>
						<p className={styles.heroNote}>Desde {formatCLP(Math.min(...PLANS.map((p) => p.price)))} + IVA al mes.</p>
					</div>
					<SampleBudget />
				</section>

				<section id="funciones" className={styles.section}>
					<div className={styles.sectionHead}>
						<h2 className={styles.h2}>Lo que hace por tu taller</h2>
						<p className={styles.sectionLead}>Todo esto ya funciona y está incluido en ambos planes.</p>
					</div>
					<ul className={styles.features}>
						{FEATURES.map(({ icon: Icon, title, text }) => (
							<li key={title} className={styles.feature}>
								<span className={styles.featureIcon} aria-hidden>
									<Icon size={22} strokeWidth={1.8} />
								</span>
								<div>
									<h3 className={styles.h3}>{title}</h3>
									<p className={styles.featureText}>{text}</p>
								</div>
							</li>
						))}
					</ul>
				</section>

				<section className={`${styles.section} ${styles.stepsSection}`}>
					<h2 className={styles.h2}>Así de simple</h2>
					{/* Es una secuencia real: por eso va numerada. */}
					<ol className={styles.steps}>
						{STEPS.map((step, i) => (
							<li key={step.title} className={styles.step}>
								<span className={styles.stepNumber} aria-hidden>
									{i + 1}
								</span>
								<h3 className={styles.h3}>{step.title}</h3>
								<p className={styles.featureText}>{step.text}</p>
							</li>
						))}
					</ol>
				</section>

				<section id="planes" className={`${styles.section} ${styles.plansSection}`}>
					<div className={styles.sectionHead}>
						<h2 className={styles.h2}>Planes</h2>
						<p className={styles.sectionLead}>Pago mensual. Los precios no incluyen IVA.</p>
					</div>
					<div className={styles.plans}>
						{PLANS.map((plan) => (
							<article key={plan.id} className={`${styles.plan} ${plan.highlighted ? styles.planPro : ""}`}>
								<h3 className={styles.planName}>{plan.name}</h3>
								<p className={styles.planPitch}>{plan.pitch}</p>
								<p className={styles.price}>
									<span className={styles.priceValue}>{formatCLP(plan.price)}</span>
									<span className={styles.priceUnit}>+ IVA al mes</span>
								</p>
								<p className={styles.priceTotal}>{formatCLP(withIva(plan.price))} con IVA incluido</p>
								<ul className={styles.planFeatures}>
									{plan.features.map((feature) => (
										<li key={feature}>
											<CheckIcon size={18} aria-hidden className={styles.yes} />
											{feature}
										</li>
									))}
								</ul>
								<a
									href={contactHref(contact, `Hola, quiero contratar el plan ${plan.name} de CorvusGarage.`)}
									className={plan.highlighted ? styles.primary : styles.secondaryDark}
									{...(hasContact ? { target: "_blank", rel: "noreferrer" } : {})}
								>
									{hasContact ? `Quiero el plan ${plan.name}` : "Ingresar"}
								</a>
							</article>
						))}
					</div>

					<div className={styles.compareWrap}>
						<table className={styles.compare}>
							<caption className={styles.compareCaption}>Comparación de planes</caption>
							<thead>
								<tr>
									<th scope="col">Incluye</th>
									<th scope="col">Taller</th>
									<th scope="col">Taller Pro</th>
								</tr>
							</thead>
							<tbody>
								{PLAN_COMPARISON.map((row) => (
									<tr key={row.feature}>
										<th scope="row">{row.feature}</th>
										<td>
											<Cell value={row.taller} />
										</td>
										<td>
											<Cell value={row.pro} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>

				<section id="preguntas" className={styles.section}>
					<h2 className={styles.h2}>Preguntas frecuentes</h2>
					<div className={styles.faq}>
						{FAQ.map(({ q, a }) => (
							<details key={q} className={styles.faqItem}>
								<summary>{q}</summary>
								<p>{a}</p>
							</details>
						))}
					</div>
				</section>

				<section className={styles.closing}>
					<h2 className={styles.closingTitle}>Deja el cuaderno y la calculadora.</h2>
					<a href="#planes" className={styles.primary}>
						Elegir un plan
					</a>
				</section>
			</main>

			<footer className={styles.footer}>
				<span>CorvusGarage es una solución de Corvus IT.</span>
				<span className={styles.footerLinks}>
					{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
					<Link href="/login">Ingresar</Link>
				</span>
			</footer>
		</div>
	);
}
