# Bitácora del harness

> Registro cronológico de las acciones del analista, desarrollador y revisor. Solo se añaden entradas al final.

### 2026-11-01 21:30 · analista
- Objetivo: Implementar el listado de mis cotizaciones/estimaciones realizadas.
- Tareas creadas: T-001 … T-010
- Observaciones: No existe esquema de cotizaciones (se crea en T-002/T-003, migración solo aditiva). `db` no se exporta y `drizzle.config.ts` apunta a un schema inexistente (T-001). No hay autenticación: "mis" se resuelve con `getCurrentUser()` provisional basado en `DEV_USER_ID` (T-005). `cacheComponents: true` activo: datos dinámicos dentro de `<Suspense>`. Dudas abiertas: relación usuario-empresa, formato de moneda/total, BD dev vs prod, nombre "Presupuestos" vs "Cotizaciones".

### 2026-11-01 21:39 · analista
- Objetivo: Replanificar el listado de presupuestos con las decisiones del usuario (sustituye la planificación de 21:30; ninguna tarea había empezado).
- Tareas creadas: T-001 … T-010 (reemplazan a las anteriores T-001 … T-010)
- Observaciones: Sin drizzle-kit: los cambios de esquema se entregan como SQL en `.harness/sql/` y el usuario los ejecuta a mano (T-002: `001_users_company_id.sql`; T-004: `002_seed_budgets_dev.sql` opcional). `budgets`/`budget_details` ya existen y se mapean tal cual (T-003), sin columna de estado: el estado se deriva de `active` y de `date + validity_days` (vigente/vencido/anulado), en SQL. "Mis" = empresa del usuario actual (`budgets.user_id` → `users.company_id`); usuario por `DEV_USER_ID`. Término de UI: "Presupuestos". Dudas nuevas: NOT NULL de `users.company_id`, existencia de FKs/índices en budgets, unicidad de `code`.

### 2026-11-01 21:42 · desarrollador · T-001
- Cambios: `lib/db/index.ts` exporta `db = drizzle({ client: sql, relations })` con `import 'server-only'`; `lib/db/relations.ts` renombra `userRelations` → `relations` y usa `defineRelations(schema, …)` sobre todas las tablas (users.role / roles.users); `drizzle.config.ts` → `./lib/db/schemas`; `pnpm add server-only`.
- Comprobaciones: tsc ✅, lint ✅ (1 warning preexistente ajeno en app-shell.tsx), chequeo de tipos de `db.query.users/roles` con `with` ✅. Sin drizzle-kit ni SQL.
- Pendiente/Riesgos: scripts `tsx` que importen `lib/db` necesitan `NODE_OPTIONS='--conditions=react-server'` por `server-only` (relevante en T-003/T-005/T-006).

### 2026-11-01 21:43 · revisor · T-001 · ✅ aprobada
- Comprobaciones: tsc ✅, lint ✅ (0 errores, 1 warning preexistente ajeno), build ✅, funcional ✅
- Evidencia: diff acotado a `lib/db/index.ts`, `lib/db/relations.ts`, `drizzle.config.ts` (+ `server-only` en package.json/lock); sin refs a `userRelations` ni scripts `db:*`; chequeo de tipos de `db.query` con `with` OK (`role` no opcional); consultas relacionales de solo lectura contra la BD terminan sin error (`undefined` / `[]`, tablas vacías).

### 2026-11-01 21:44 · desarrollador · T-002
- Cambios: nuevo `.harness/sql/001_users_company_id.sql` (idempotente, transaccional, FK guardada con `DO $$` + `pg_constraint`, índice `users_company_id_idx`, `UPDATE` y `SET NOT NULL` solo comentados); `lib/db/schemas/users.ts` añade `companyId` nullable con `.references(() => companies.id)` e índice; `lib/db/relations.ts` añade `users.company` (one, opcional) y `companies.users` (many).
- Comprobaciones: tsc ✅, lint ✅ (1 warning preexistente ajeno), chequeo de tipos de `with: { company }` / `companies.users` ✅. Solo SELECT de inspección contra la BD; SQL NO ejecutado.
- Pendiente/Riesgos: hasta que el usuario aplique el SQL, las consultas que lean `users` vía Drizzle fallarán por columna inexistente (bloquea verificaciones en BD de T-003/T-005/T-006).

### 2026-11-01 21:45 · revisor · T-002 · ✅ aprobada
- Comprobaciones: tsc ✅, lint ✅ (0 errores, 1 warning preexistente ajeno), build —, funcional ✅ (revisión del SQL por lectura + SELECT de inspección)
- Evidencia: SQL idempotente y transaccional, FK guardada con `DO $$`/`pg_constraint`, índice `IF NOT EXISTS`, sin DROP; `companies.id` es `integer` con `companies_pkey`; `users.company_id`, `users_company_id_fkey` y `users_company_id_idx` aún no existen (sin colisiones); esquema TS y relaciones coherentes (nullable). El SQL NO se ejecutó; queda pendiente de aplicación manual por el usuario.

### 2026-11-01 21:47 · desarrollador · T-003
- Cambios: nuevos `lib/db/schemas/budgets.ts` y `lib/db/schemas/budgetDetails.ts` (mapeo 1:1 de las tablas existentes, incluidos UNIQUE, índices y CHECKs con sus nombres reales; montos `numeric` en `mode: 'number'`; `total_amount` de detalles como columna generada); re-export en `lib/db/schemas/index.ts`; relaciones budgets/budgetDetails e inversas en `lib/db/relations.ts`.
- Comprobaciones: tsc ✅, lint ✅ (1 warning preexistente ajeno), columnas vs `information_schema` ✅, `db.query.budgets.findFirst` sin `user` ✅ (`undefined`), con `user` ❌ esperado (`users.company_id` no existe hasta aplicar SQL 001). Solo SELECT; sin drizzle-kit.
- Pendiente/Riesgos: la BD NO tiene FKs en budgets/budget_details (los `.references()` son documentales); `code` y `budget_number` son UNIQUE globales (no por empresa). Re-ejecutar la consulta completa tras aplicar `001_users_company_id.sql`.

### 2026-11-01 21:49 · revisor · T-003 · ✅ aprobada
- Comprobaciones: tsc ✅, lint ✅ (0 errores, 1 warning preexistente ajeno), build —, funcional ✅
- Evidencia: 26 columnas de `information_schema` coinciden 1:1 con `budgets.ts`/`budgetDetails.ts` (tipos, precisión, nulabilidad, defaults, identity ALWAYS, columna generada); UNIQUE/índices/CHECKs con nombres idénticos a `pg_constraint`/`pg_indexes`; sin FKs reales (references documentales). `users.company_id` ya existe (SQL 001 aplicado por el usuario): la consulta relacional completa `budgets.findFirst({ with: { client, vehicle, user, details: { with: { serviceType } } } })` termina sin error (`undefined`, 0 filas), igual que las inversas. Solo SELECT; sin drizzle-kit.
- Observación: `budget_number` UNIQUE global (no por empresa) — para el analista.

### 2026-11-01 21:51 · desarrollador · T-004
- Cambios: nuevo `.harness/sql/002_seed_budgets_dev.sql` (SOLO DESARROLLO / opcional, `BEGIN…COMMIT`): 2 empresas, rol `admin`, 3 usuarios con `company_id` (2 A, 1 B), 3 clientes, 3 vehículos + `client_vehicles`, 3 `service_types`, 16 `budgets` (A: 4 vigentes/3 vencidos/3 anulados; B: 2/2/2) con 2-3 `budget_details` cada uno. Idempotente (`WHERE NOT EXISTS` por clave natural + `ON CONFLICT DO NOTHING`), sin ids explícitos ni `budget_details.total_amount`, sin DELETE/TRUNCATE/DROP.
- Comprobaciones: tsc ✅, lint ✅ (1 warning preexistente ajeno), SQL NO ejecutado; sintaxis/tipos validados ejecutando solo los SELECT de cada INSERT ✅; estados derivados e importes verificados sobre la tabla VALUES ✅.
- Pendiente/Riesgos: el usuario debe ejecutar el SQL a mano; fechas relativas al momento de ejecución (los vigentes caducan con el tiempo). La tabla real es `client_vehicles` (plural). Clientes/vehículos no tienen empresa (compartidos).

### 2026-11-01 21:52 · desarrollador · T-004 (ajuste)
- Cambios: por decisión del usuario (una sola empresa por BD, sin FKs nuevas), el seed crea 1 empresa, 2 usuarios con `company_id` y 1 usuario sin empresa (`dev.sin.empresa@cotiza.test`) que tiene 6 presupuestos (2/2/2). Se elimina la segunda empresa. El SELECT de comprobación comentado usa LEFT JOIN.
- Comprobaciones: tsc ✅, lint ✅ (sin cambios de código TS), SELECT de los 9 INSERT revalidados ✅, grep DELETE/TRUNCATE/DROP = 0 ✅. SQL NO ejecutado.
- Pendiente/Riesgos: el criterio "2 empresas" queda desviado a propósito; el analista debería actualizar los criterios de T-004 y T-006.

### 2026-11-01 21:54 · revisor · T-004 · ✅ aprobada
- Comprobaciones: tsc ✅, lint ✅ (0 errores, 1 warning preexistente ajeno), build —, funcional ✅ (lectura del SQL + SELECT de inspección/validación; SQL 002 NO ejecutado)
- Evidencia: 9 tablas vacías; PK identity ALWAYS en todas y `budget_details.total_amount` GENERATED → el seed no inserta ids ni esa columna. NOT NULL/UNIQUE/CHECK reales (pg_constraint) respetados; cada uno de los 9 INSERT con `NOT EXISTS` por su clave UNIQUE (+ `ON CONFLICT DO NOTHING`); partes SELECT de los 9 INSERT ejecutadas sin error; simulación de los 16 budgets: estado derivado = esperado 16/16, importes coherentes 16/16; reparto empresa 4/3/3, sin empresa 2/2/2. Sin DELETE/TRUNCATE/DROP/UPDATE.
- Criterio "2 empresas" evaluado contra la decisión vigente del usuario (1 empresa + 2 usuarios con empresa + 1 sin `company_id`).
- Observaciones: seed añadiría 2.ª empresa si ya hubiera otra con distinto rut; `LIKE 'DEV-%'` amplio; los vigentes caducan a partir de 6 días tras ejecutar.

### 2026-11-01 21:55 · analista
- Objetivo: Ajustar los criterios de aceptación de T-005 a T-010 a las decisiones del usuario (una sola empresa por BD, sin FKs, `code`/`budget_number` UNIQUE globales) y al seed `002_seed_budgets_dev.sql` aprobado.
- Tareas creadas: ninguna (solo se ajustan los criterios de T-005, T-006, T-007, T-008 y T-009; T-010 no necesitaba cambios. No se tocaron T-001 a T-004 ni los estados).
- Observaciones: Se quitaron todas las referencias a "empresa A/B". Las verificaciones usan los datos del seed: la empresa ve exactamente `DEV-0001` … `DEV-0010` (4 vigentes, 3 vencidos y 3 anulados con el seed recién aplicado) y ninguno de `DEV-0011` … `DEV-0016` del usuario sin empresa. Se añadió como condición previa que el usuario haya aplicado el seed 002, comprobable solo con `SELECT`, y una consulta de referencia para el estado derivado, porque los vigentes caducan con el paso de los días. Se mantienen los casos "sin usuario" y "usuario sin empresa".

### 2026-11-01 21:57 · desarrollador · T-005
- Cambios: nuevo `lib/auth/current-user.ts` (`server-only`, `getCurrentUser` con `React.cache`, `DEV_USER_ID` validado como int4 positivo, `users INNER JOIN roles` con `active = true`, comentario `TODO(auth)`); nuevo `.env.example` (`DATABASE_URL=`, `DEV_USER_ID=`); `.gitignore` con excepción `!.env.example`. `.env` sin tocar.
- Comprobaciones: tsc ✅, lint ✅ (0 errores, 1 warning preexistente ajeno); script de scratchpad: sin definir / vacío / `abc` / `999999` / `-1` / `1.5` / `99999999999` → `null` ✅.
- Pendiente/Riesgos: seed 002 NO aplicado (0 budgets DEV-%, 0 usuarios dev.*, tablas `users` y `companies` vacías). Falta la verificación con `dev.a1`/`dev.a2` (companyId de la única empresa) y `dev.sin.empresa` (companyId null) cuando el usuario aplique `.harness/sql/002_seed_budgets_dev.sql`. Usuario con `role_id` inexistente → `null` (decisión anotada).

### 2026-11-01 21:58 · desarrollador · T-010
- Cambios: `app/components/app-shell.tsx`: menú lateral con `NAV_ITEMS` (`/`, `/budgets`, `/clients`, `/vehicles`), labels con `next/link` y `selectedKeys` derivado de `usePathname()` (coincidencia exacta o por prefijo `href/`). Header del usuario, `ChevronDownIcon`, `app/layout.tsx` y `app/page.tsx` intactos.
- Comprobaciones: tsc ✅, lint ✅ (0 errores, 1 warning preexistente ajeno), build ✅ (13 rutas), SSR en dev ✅ (`/budgets/ABC-1` → Presupuestos seleccionado; `/clients/5`, `/vehicles/new-vehicle`, `/` correctos).
- Pendiente/Riesgos: consola del navegador no revisada (sin navegador); el revisor debe confirmar ausencia de errores de hidratación y navegación cliente al hacer clic.

### 2026-11-01 22:02 · revisor · T-010 · pendiente de navegador (sigue en `en_revision`)
- Comprobaciones: tsc ✅, lint ✅ (0 errores, 1 warning previo del usuario), build ✅ (13 rutas), funcional ✅ (SSR de dev)
- Evidencia: GET contra el `next dev` del usuario en el 3000 (no se puede arrancar un segundo dev en el mismo directorio; no se detuvo): `/` → Inicio, `/budgets` y `/budgets/ABC-1` → Presupuestos, `/clients/5` → Clientes, `/vehicles/new-vehicle` → Vehículos, `/budgets-x` (404) → ninguno; los 4 `<a href>` están en todas. En el código no se ve ninguna causa de hydration mismatch.
- Pendiente: verificación en navegador (consola/hidratación y clic sin recarga). Criterio 3 sin marcar solo por eso.
- Observación (no es de T-010): con `next start` el HTML SSR solo trae el fallback del `<Suspense>` de `app/layout.tsx` (el shell se pinta en el cliente); también pasa sin `usePathname` (comprobado en una copia temporal).
