import { NextResponse, type NextRequest } from "next/server";

/*
 * Revisión optimista: sin cookie de sesión → al login (salvo las páginas
 * públicas: la de venta en `/` y el login). La validación real
 * (sesión vigente, usuario activo, empresa) la hace `authorize()` en el
 * servidor, en cada página y Server Action.
 */
const SESSION_COOKIE = "cg_session";
const PUBLIC_PATHS = new Set(["/", "/login"]);

export function proxy(request: NextRequest) {
	const { pathname, search } = request.nextUrl;
	if (PUBLIC_PATHS.has(pathname) || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

	const url = new URL("/login", request.url);
	url.searchParams.set("next", `${pathname}${search}`);
	return NextResponse.redirect(url);
}

export const config = {
	// Todo salvo los archivos estáticos de Next y los de `public/`.
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
