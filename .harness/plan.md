# Plan de trabajo — cotiza

> Gestionado por el harness (`/harness`). Fuente de verdad del progreso.
> Estados: `pendiente` → `en_progreso` → `en_revision` → `aprobada` | `rechazada`.
> **Solo el revisor marca `[x]`.**
>
> **Política de BD (decisión del usuario):** no se usa drizzle-kit (`generate`/`push`/`migrate` prohibidos). Todo cambio de esquema se entrega como SQL de PostgreSQL en `.harness/sql/NNN_descripcion.sql`, que el usuario ejecuta a mano; las tareas **no** ejecutan ese SQL. Los esquemas TS de `lib/db/schemas/` deben reflejar la BD real. Las verificaciones contra BD solo pueden usar consultas de lectura (`SELECT`).
>
> **Decisiones del usuario (2026-11-01):**
> - Una BD = una sola empresa. Si aparecen más empresas, tendrán otra BD/sistema. No se diseña multiempresa.
> - "Mis presupuestos" = los de la empresa del usuario actual (filtro por `users.company_id`).
> - Usuario actual vía variable de entorno `DEV_USER_ID` mientras no haya login.
> - **Sin FKs en la BD** para `budgets`/`budget_details` (los `.references()` del TS son solo documentación).
> - `code` y `budget_number` siguen siendo UNIQUE globales.
> - Montos en CLP, IVA separado (neto/iva/total). Sin columna de estado: se deriva de `active` y vigencia.
> - En la UI se usa el término "Presupuestos".

## Resumen

- [x] T-001 · Exportar `db` con relaciones (infra Drizzle de solo lectura) — `aprobada`
- [x] T-002 · SQL y esquema TS de `users.company_id` — `aprobada`
- [x] T-003 · Esquemas Drizzle de `budgets` y `budget_details` (mapeo de tablas existentes) — `aprobada`
- [x] T-004 · SQL opcional de datos de prueba de presupuestos — `aprobada`
- [ ] T-005 · Usuario actual provisional (`getCurrentUser` vía `DEV_USER_ID`) — `en_revision`
- [ ] T-006 · Consulta `getCompanyBudgets` y estado derivado (vigente/vencido/anulado) — `pendiente`
- [ ] T-007 · Página `/budgets` con tabla de presupuestos de mi empresa — `pendiente`
- [ ] T-008 · Filtros, búsqueda y paginación por `searchParams` — `pendiente`
- [ ] T-009 · Estados de carga, error y vacío en `/budgets` — `pendiente`
- [ ] T-010 · Navegación del menú lateral hacia rutas reales — `en_revision`

## Detalle

### T-001 · Exportar `db` con relaciones (infra Drizzle de solo lectura)
- **Estado:** aprobada
- **Depende de:** —
- **Descripción:** `lib/db/index.ts` crea `db` pero no lo exporta ni le pasa relaciones, y `drizzle.config.ts` apunta a `./lib/db/schema.ts` (inexistente). Dejar la conexión lista para consultar desde el servidor. No se añaden scripts de drizzle-kit.
- **Criterios de aceptación:**
  - [x] `lib/db/index.ts` exporta `db = drizzle({ client: sql, relations })` e importa `server-only` (`pnpm add server-only` si no está).
  - [x] `lib/db/relations.ts` exporta un único objeto `relations` creado con `defineRelations` sobre todas las tablas de `lib/db/schemas` (users↔roles por ahora; se amplía en T-002/T-003). Se elimina/renombra `userRelations` sin dejar imports rotos.
  - [x] `drizzle.config.ts` apunta a `./lib/db/schemas` (solo corrección de ruta; **no** se ejecuta ningún comando de drizzle-kit y no se añaden scripts `db:*` a `package.json`).
  - [x] `pnpm exec tsc --noEmit` y `pnpm lint` pasan.
- **Archivos previstos:** `lib/db/index.ts`, `lib/db/relations.ts`, `drizzle.config.ts`, `package.json` (solo si se añade `server-only`).
- **Notas del analista:** drizzle-orm `1.0.0-rc.4` (relaciones v2: `defineRelations`, `r.one.x({ from, to })`, `r.many.x()`); confirmar firmas en `node_modules/drizzle-orm`. `package.json` tiene cambios sin commitear del usuario: no pisarlos.
- **Notas del desarrollador:**
  - Archivos: `lib/db/index.ts` (añade `import 'server-only'`, exporta `db = drizzle({ client: sql, relations })`), `lib/db/relations.ts` (`userRelations` → `relations`, ahora `defineRelations(schema, …)` con `import * as schema from './schemas'`, es decir, todas las tablas; relaciones users.role (one, `optional: false`) y roles.users (many)), `drizzle.config.ts` (`schema: './lib/db/schemas'`), `package.json`/`pnpm-lock.yaml` (`pnpm add server-only` → `server-only ^0.0.1`; los cambios previos del usuario en `package.json` se conservan; no se añaden scripts `db:*`).
  - `userRelations` no tenía importadores (grep en `app/` y `lib/`: sin referencias), así que el renombrado no rompe nada.
  - No se ejecutó ningún comando de drizzle-kit ni SQL.
  - Comprobaciones: `pnpm exec tsc --noEmit` OK; `pnpm lint` OK (0 errores; 1 warning preexistente ajeno: `ChevronDownIcon` sin usar en `app/components/app-shell.tsx`). Además, chequeo de tipos temporal (archivo borrado) de `db.query.users.findFirst({ with: { role: true } })` y `db.query.roles.findMany({ with: { users: true } })`: compila.
  - Aviso para T-003/T-005/T-006 (scripts con `tsx`): el paquete `server-only` lanza error si se importa fuera de la condición `react-server`. Los scripts desechables deben ejecutarse con `NODE_OPTIONS='--conditions=react-server' pnpm exec tsx script.ts` (o importar `drizzle`/`relations` directamente sin pasar por `lib/db/index.ts`).
- **Revisión:** 2026-11-01 21:43 · revisor · aprobada
  - Diff limitado a `lib/db/index.ts`, `lib/db/relations.ts`, `drizzle.config.ts` y la línea `server-only ^0.0.1` en `package.json`/`pnpm-lock.yaml` (el resto del diff de esos dos archivos —antd, nextjs-registry, lucide-react— es previo del usuario y se conserva). Sin scripts `db:*`.
  - `pnpm exec tsc --noEmit` → OK; `pnpm lint` → 0 errores (1 warning preexistente en `app/components/app-shell.tsx`); `pnpm build` → OK (13 rutas).
  - `userRelations` / `lib/db/schema.ts`: 0 referencias restantes (grep). `lib/db/schemas/index.ts` solo exporta tablas `pgTable`, así que `defineRelations(schema, …)` recibe todas las tablas.
  - Chequeo de tipos externo (scratchpad): `db.query.users.findFirst({ with: { role: true } })` da `role` no opcional; `roles.findMany({ with: { users: true } })` da array; `with: { nope: true }` falla como se espera.
  - Ejecución de solo lectura (scratchpad, `NODE_OPTIONS='--conditions=react-server' node --env-file=.env --import tsx`): `users.findFirst` con `role` → `undefined`, `roles.findMany` con `users` → `[]`, sin errores (tablas vacías). Sin la condición `react-server`, `server-only` lanza error, como indicó el desarrollador.
  - No se ejecutó drizzle-kit ni SQL de escritura.

### T-002 · SQL y esquema TS de `users.company_id`
- **Estado:** aprobada
- **Depende de:** T-001
- **Descripción:** "Mis presupuestos" = presupuestos de la empresa del usuario actual. `users` no tiene empresa: entregar el DDL para añadirla y reflejarlo en el esquema TS.
- **Criterios de aceptación:**
  - [x] Existe `.harness/sql/001_users_company_id.sql` con DDL PostgreSQL idempotente y transaccional, equivalente a:
    ```sql
    BEGIN;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id int4 NULL;
    ALTER TABLE users ADD CONSTRAINT users_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies(id);   -- guardado con DO $$ ... IF NOT EXISTS
    CREATE INDEX IF NOT EXISTS users_company_id_idx ON users (company_id);
    COMMIT;
    -- Paso manual posterior (comentado): UPDATE users SET company_id = <id> WHERE ...;
    -- Opcional tras rellenar: ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
    ```
    El `ADD CONSTRAINT` va envuelto en un bloque `DO $$ ... $$` que comprueba `pg_constraint` para poder re-ejecutar sin error. Sin `DROP` de ningún tipo.
  - [x] `lib/db/schemas/users.ts` añade `companyId: integer('company_id').references(() => companies.id)` (nullable, coherente con el SQL) e índice `users_company_id_idx` en el callback de tabla.
  - [x] `lib/db/relations.ts` incluye `users.company` (one) y `companies.users` (many).
  - [x] **La tarea no ejecuta el SQL.** El desarrollador lo deja listo y lo indica en notas para que el usuario lo aplique.
  - [x] `pnpm exec tsc --noEmit` pasa.
- **Archivos previstos:** `.harness/sql/001_users_company_id.sql`, `lib/db/schemas/users.ts`, `lib/db/relations.ts`.
- **Notas del analista:** Columna nullable para no romper los usuarios existentes; el código (T-005/T-006) debe tratar `companyId = null` como "sin empresa" → lista vacía. Ver duda 1 sobre NOT NULL.
- **Notas del desarrollador:**
  - Archivos: `.harness/sql/001_users_company_id.sql` (nuevo), `lib/db/schemas/users.ts`, `lib/db/relations.ts`.
  - SQL: `BEGIN; ADD COLUMN IF NOT EXISTS company_id int4 NULL; DO $$ … IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_company_id_fkey' AND conrelid='public.users'::regclass) THEN ADD CONSTRAINT … FK → companies(id) … $$; CREATE INDEX IF NOT EXISTS users_company_id_idx; COMMIT;`. Al final, comentados: el `UPDATE users SET company_id = …` manual y el `SET NOT NULL` opcional (decisión vigente: la columna queda nullable). Sin `DROP`.
  - **El SQL NO se ha ejecutado.** Debe aplicarlo el usuario a mano (p. ej. `psql "$DATABASE_URL" -f .harness/sql/001_users_company_id.sql` o en la consola de Neon). Hasta entonces, cualquier consulta que seleccione `users` con el esquema TS fallará (`column "company_id" does not exist`), lo que afecta a las verificaciones de T-003/T-005/T-006.
  - Inspección de solo lectura previa (SELECT a `information_schema`/`pg_constraint`/`pg_indexes`): `users.company_id` no existe aún; `companies.id` es `integer` (coincide con `int4`); en `users` ya existen `users_role_id_fkey` e `idx_users_role_id` (no se tocan).
  - Esquema TS: `companyId: integer("company_id").references(() => companies.id)` (nullable) e `index("users_company_id_idx").on(table.companyId)` en el callback de tabla (formato array).
  - Relaciones: `users.company` = `r.one.companies({ from: r.users.companyId, to: r.companies.id })` sin `optional: false` (nullable); `companies.users` = `r.many.users()`.
  - Comprobaciones: `pnpm exec tsc --noEmit` OK; `pnpm lint` OK (0 errores, 1 warning preexistente ajeno en `app/components/app-shell.tsx`). Chequeo de tipos temporal (archivo borrado): `db.query.users.findFirst({ with: { company: true } })` da `company` nullable (asignarlo a tipo no-null falla con `@ts-expect-error` como se espera) y `companies.findMany({ with: { users: true } })` da array. No se ejecutó drizzle-kit ni consultas contra la columna nueva.
- **Revisión:** 2026-11-01 21:45 · revisor · aprobada
  - Alcance: `.harness/sql/001_users_company_id.sql` (nuevo), `lib/db/schemas/users.ts` (reformateo a callback de tabla + `companyId` + índice), `lib/db/relations.ts` (`users.company`, `companies.users`). Resto del árbol: cambios previos del usuario / T-001.
  - SQL revisado por lectura (NO ejecutado, ni siquiera en transacción con ROLLBACK): `BEGIN/COMMIT`; `ADD COLUMN IF NOT EXISTS company_id int4 NULL`; FK `users_company_id_fkey → companies(id)` dentro de `DO $$` con guarda en `pg_constraint` (conname + `conrelid = 'public.users'::regclass`); `CREATE INDEX IF NOT EXISTS users_company_id_idx`; `UPDATE` y `SET NOT NULL` solo comentados. grep `DROP|DELETE|TRUNCATE`: solo aparece en el comentario de cabecera. Re-ejecutable sin error.
  - Inspección de solo lectura (SELECT a information_schema/pg_constraint/pg_indexes): `public.companies.id` = `integer` NOT NULL con `companies_pkey` (FK válida, tipos coherentes con `int4`); `users.company_id` aún no existe; no hay constraint `users_company_id_fkey` ni índice `users_company_id_idx` previos (sin colisión); `search_path = "$user", public` → `users` sin calificar = `public.users`, coherente con la guarda.
  - Esquema TS: `integer("company_id").references(() => companies.id)` nullable + `index("users_company_id_idx").on(table.companyId)`; `companies` re-exportada en `schemas/index.ts`, sin import circular. Relación `users.company` sin `optional: false` (coherente con nullable).
  - `pnpm exec tsc --noEmit` → OK; `pnpm lint` → 0 errores (1 warning preexistente en `app/components/app-shell.tsx`). Build no requerida (sin rutas/config).
  - Pendiente del usuario: aplicar el SQL a mano; hasta entonces las consultas Drizzle sobre `users` fallarán por `company_id` inexistente (esperado).

### T-003 · Esquemas Drizzle de `budgets` y `budget_details` (mapeo de tablas existentes)
- **Estado:** aprobada
- **Depende de:** T-001
- **Descripción:** Las tablas ya existen en la BD. Crear los esquemas TS que las reflejen **exactamente** (nombres, tipos, nulabilidad, defaults), sin columnas inventadas (no hay columna de estado).
- **Criterios de aceptación:**
  - [x] `lib/db/schemas/budgets.ts` define `budgets` con: `id` (identity always), `code varchar(30) NOT NULL`, `budgetNumber` (`budget_number int4 NOT NULL`), `clientId`, `vehicleId`, `userId` (int4 NOT NULL, `.references()` a clients/vehicles/users), `date` (`date`, default `CURRENT_DATE`, NOT NULL), `validityDays` (int4 default 15 NOT NULL), `diagnosis` (text null), `sparePartsAmount`, `labourAmount`, `otherChargesAmount`, `discount`, `netoAmount`, `ivaAmount`, `totalAmount` (todos `numeric(14,2)` default 0 NOT NULL), `estimatedDeliveryDate` (date null), `additionalObservations` (text null), `active` (bool default true NOT NULL).
  - [x] `lib/db/schemas/budgetDetails.ts` define `budget_details` con: `id`, `budgetId` (→ budgets), `serviceTypeId` (→ service_types), `description varchar(255) NOT NULL`, `quantity numeric(10,2) default 1 NOT NULL`, `unitAmount numeric(14,2) NOT NULL`, `totalAmount numeric(14,2)` con `.generatedAlwaysAs(sql\`quantity * unit_amount\`)`.
  - [x] Tipos `Budget`, `NewBudget`, `BudgetDetail`, `NewBudgetDetail` exportados; ambas tablas re-exportadas en `lib/db/schemas/index.ts`.
  - [x] Relaciones en `lib/db/relations.ts`: budget → client, vehicle, user (one, `optional: false`), budget → details (many); detail → budget, serviceType (one); inversas `clients.budgets`, `vehicles.budgets`, `users.budgets`, `serviceTypes.budgetDetails`.
  - [x] Verificación de solo lectura: un script desechable en el scratchpad (no en el repo) ejecutado con `pnpm exec tsx` hace `db.query.budgets.findFirst({ with: { client: true, vehicle: true, user: true, details: { with: { serviceType: true } } } })` y termina sin error (aunque devuelva `undefined` si no hay filas). Se pega la salida en notas.
  - [x] Verificación de columnas: una consulta `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name IN ('budgets','budget_details') ORDER BY 1, ordinal_position` coincide con el esquema TS (resultado pegado en notas).
  - [x] `pnpm exec tsc --noEmit` pasa.
- **Archivos previstos:** `lib/db/schemas/budgets.ts`, `lib/db/schemas/budgetDetails.ts`, `lib/db/schemas/index.ts`, `lib/db/relations.ts`.
- **Notas del analista:** Para montos usar `numeric(..., { precision: 14, scale: 2, mode: 'number' })` (soportado en esta versión; evita strings) — los CLP caben sin pérdida en `number`. El nombre de columna `"date"` es palabra reservada: mapear como `date('date')`. Si la BD no tiene FKs reales, `.references()` es inocuo para lectura, pero ver duda 2.
- **Notas del desarrollador:**
  - Archivos: nuevos `lib/db/schemas/budgets.ts` y `lib/db/schemas/budgetDetails.ts`; `lib/db/schemas/index.ts` (re-exporta ambos); `lib/db/relations.ts` (budgets.client/vehicle/user `optional: false`, budgets.details, budgetDetails.budget/serviceType, inversas `users.budgets`, `clients.budgets`, `vehicles.budgets`, `serviceTypes.budgetDetails`). Sin drizzle-kit ni SQL de escritura; solo SELECT de inspección.
  - Respuesta a las dudas abiertas (inspección de `pg_constraint` / `pg_indexes`):
    - **FKs: NO existen** en ninguna de las dos tablas (solo PK, NOT NULL, UNIQUE y CHECK). Aun así se mantienen los `.references()` que exige el criterio; quedan comentados en el código como "documentales". Si se quieren FKs reales habría que planificar un SQL `.harness/sql/NNN_…` (trabajo para el analista; no hay filas, así que sería seguro).
    - **`code` es UNIQUE** (`budgets_code_key`). También **`budget_number` es UNIQUE** (`budgets_budget_number_key`) — global, no por empresa (posible problema multi-empresa; anotar para el analista).
    - **Índices:** `idx_budgets_client_id`, `idx_budgets_vehicle_id`, `idx_budgets_user_id`, `idx_budgets_date`, `idx_budget_details_budget_id`, `idx_budget_details_service_type_id` (+ PKs y los dos UNIQUE).
    - **CHECKs:** montos de budgets `>= 0`, `validity_days > 0`, `quantity > 0`, `unit_amount >= 0`.
  - Decisión: para reflejar fielmente la BD, el esquema TS declara también los UNIQUE, índices y CHECKs con sus **nombres reales** (no afecta a lectura; evita divergencias si algún día se compara con la BD). Montos con `numeric(..., { mode: 'number' })`; `date('date')`; `budget_details.total_amount` con `.generatedAlwaysAs(sql\`quantity * unit_amount\`)` (nullable en la BD, igual que en TS).
  - Verificación de columnas (`information_schema.columns`, resumido: tabla.columna tipo nullable default [extra]):
    ```
    budget_details.id               integer        NO   -            identity ALWAYS
    budget_details.budget_id        integer        NO   -
    budget_details.service_type_id  integer        NO   -
    budget_details.description      varchar(255)   NO   -
    budget_details.quantity         numeric(10,2)  NO   1
    budget_details.unit_amount      numeric(14,2)  NO   -
    budget_details.total_amount     numeric(14,2)  YES  -            generated ALWAYS (quantity * unit_amount)
    budgets.id                      integer        NO   -            identity ALWAYS
    budgets.code                    varchar(30)    NO   -
    budgets.budget_number           integer        NO   -
    budgets.client_id               integer        NO   -
    budgets.vehicle_id              integer        NO   -
    budgets.user_id                 integer        NO   -
    budgets.date                    date           NO   CURRENT_DATE
    budgets.validity_days           integer        NO   15
    budgets.diagnosis               text           YES  -
    budgets.spare_parts_amount      numeric(14,2)  NO   0
    budgets.labour_amount           numeric(14,2)  NO   0
    budgets.other_charges_amount    numeric(14,2)  NO   0
    budgets.discount                numeric(14,2)  NO   0
    budgets.neto_amount             numeric(14,2)  NO   0
    budgets.iva_amount              numeric(14,2)  NO   0
    budgets.total_amount            numeric(14,2)  NO   0
    budgets.estimated_delivery_date date           YES  -
    budgets.additional_observations text           YES  -
    budgets.active                  boolean        NO   true
    ```
    Coincide 1:1 con el esquema TS. Filas actuales: budgets 0, budget_details 0.
  - Verificación relacional (script desechable en el scratchpad, `NODE_OPTIONS='--conditions=react-server' pnpm exec tsx --env-file=.env verify.mts`):
    ```
    [sin user] OK -> undefined
    [completa (con user)] ERROR -> column d1.company_id does not exist
    [budgetDetails] OK -> undefined
    ```
    La consulta completa del criterio (`with: { client, vehicle, user, details: { with: { serviceType } } }`) falla **solo** porque `users.company_id` aún no existe (`.harness/sql/001_users_company_id.sql` sin aplicar; esperado). Sin `user` termina sin error. **Pendiente:** re-ejecutar la consulta completa cuando el usuario aplique el SQL 001.
  - Comprobaciones: `pnpm exec tsc --noEmit` ✅; `pnpm lint` ✅ (0 errores, 1 warning preexistente ajeno en `app/components/app-shell.tsx`).
- **Revisión:** 2026-11-01 — aprobada.
  - `git status`: nuevos `lib/db/schemas/budgets.ts`, `lib/db/schemas/budgetDetails.ts`; cambios en `lib/db/schemas/index.ts` (+2 re-exports) y `lib/db/relations.ts`. Sin scripts de verificación dentro del repo.
  - `pnpm exec tsc --noEmit` ✅ (exit 0); `pnpm lint` ✅ (0 errores, 1 warning preexistente ajeno en `app/components/app-shell.tsx`). Build no requerido (no toca rutas/config).
  - `information_schema.columns` (SELECT): 26 columnas coinciden 1:1 con el TS (tipo, longitud/precisión, nulabilidad, default; `id` identity ALWAYS en ambas; `budget_details.total_amount` generated ALWAYS `(quantity * unit_amount)`, nullable). Sin columna de estado.
  - `pg_constraint`/`pg_indexes`: sin FKs reales (los `.references()` son documentales, comentado en código); UNIQUE `budgets_code_key`, `budgets_budget_number_key`; 6 índices `idx_*` y 10 CHECKs con nombres idénticos a los del TS. `id` de clients/vehicles/users/service_types es `integer`.
  - `users.company_id` YA existe en la BD (SQL 001 aplicado por el usuario). Script desechable en el scratchpad (`NODE_OPTIONS='--conditions=react-server' pnpm exec tsx --env-file=.env`): `db.query.budgets.findFirst({ with: { client, vehicle, user, details: { with: { serviceType } } } })` → `undefined` sin error; también OK `budgetDetails` (budget, serviceType), `users` (budgets, company) e inversas `clients.budgets`, `vehicles.budgets`, `serviceTypes.budgetDetails`. Filas: budgets 0, budget_details 0.
  - Observación para el analista (no bloqueante): `budget_number` UNIQUE global, no por empresa; FKs inexistentes en la BD.

### T-004 · SQL opcional de datos de prueba de presupuestos
- **Estado:** aprobada
- **Depende de:** T-002, T-003
- **Descripción:** Para poder verificar el filtrado por empresa hacen falta datos. Entregar un SQL de INSERT **opcional** que el usuario puede ejecutar a mano en una BD de desarrollo. No es un script del repo ni se ejecuta desde la tarea.
- **Criterios de aceptación:**
  - [x] Existe `.harness/sql/002_seed_budgets_dev.sql` con cabecera que indica "SOLO DESARROLLO / opcional", envuelto en `BEGIN; ... COMMIT;`.
  - [x] Inserta, si no existen (`INSERT ... SELECT ... WHERE NOT EXISTS` por `rut`/`email`/`code`): 2 empresas, 1 rol, 3 usuarios (2 de la empresa A, 1 de la empresa B, con `company_id`), 3 clientes, 3 vehículos, ≥ 2 `service_types` y ≥ 15 `budgets` con `budget_details`.
  - [x] Los presupuestos cubren los 3 estados derivados: vigentes (`date` reciente), vencidos (`date` antigua con `validity_days` 15) y anulados (`active = false`); repartidos entre las dos empresas.
  - [x] Los importes son coherentes: `neto_amount = spare_parts + labour + other_charges - discount`, `iva_amount = round(neto * 0.19)`, `total_amount = neto + iva`. No se inserta `budget_details.total_amount` (columna generada).
  - [x] Sin `DELETE`, `TRUNCATE` ni `DROP`. Re-ejecutable sin duplicar.
- **Archivos previstos:** `.harness/sql/002_seed_budgets_dev.sql`.
- **Notas del analista:** `users.password_hash` es NOT NULL: usar un valor placeholder evidente (`'dev-no-login'`). Las columnas identity son `GENERATED ALWAYS`: no insertar `id`, resolver FKs con subconsultas por `rut`/`email`/`plate`. Si la duda 4 (unicidad de `code`) se resuelve, usar el formato acordado.
- **Notas del desarrollador:**
  - Archivo: `.harness/sql/002_seed_budgets_dev.sql` (nuevo). **No se ha ejecutado** (ni con ROLLBACK); solo SELECT de inspección/validación.
  - Inspección previa (`information_schema`/`pg_constraint`): todas las tablas vacías; PK identity ALWAYS en todas; UNIQUE en `companies.rut`, `roles.code`, `users.email`, `clients.rut`, `vehicles.plate`, `service_types.name`, `budgets.code`, `budgets.budget_number`, `client_vehicles(client_id, vehicle_id)`. La tabla real es **`client_vehicles`** (plural), no `client_vehicle`. `users.role_id` y `users.company_id` sí tienen FK.
  - **Cambio de alcance por decisión del usuario (comunicado por el coordinador):** cada BD tendrá **una sola empresa** y no se crearán FKs. Por eso el seed crea **1 empresa** (no 2 como pide el criterio) y, en lugar de un usuario de la empresa B, **1 usuario sin `company_id`** para probar el estado "sin empresa". Los criterios "2 empresas" y "repartidos entre las dos empresas" quedan sustituidos por esta adaptación (desviación intencionada).
  - Contenido: 1 empresa (`76.000.001-1`), rol `admin`, 3 usuarios (`dev.a1@` y `dev.a2@cotiza.test` con empresa; `dev.sin.empresa@cotiza.test` con `company_id` NULL; `password_hash='dev-no-login'`), 3 clientes, 3 vehículos (`DEVA11`, `DEVB22`, `DEVC33`) + 3 vínculos en `client_vehicles`, 3 `service_types`, 16 `budgets` (`DEV-0001..0016`, `budget_number` 900001..900016 para no chocar con numeración real, al ser UNIQUE global) y 2-3 `budget_details` por presupuesto (repuestos, mano de obra y otros cargos si > 0; su suma = spare+labour+other).
  - Reparto: empresa (a1/a2) = 4 vigentes / 3 vencidos / 3 anulados; usuario sin empresa = 2 / 2 / 2 (sirven para comprobar que no se filtran al listado de la empresa y que el usuario sin empresa ve lista vacía). Fechas relativas a `CURRENT_DATE` (vigentes 0-10 días, vencidos 25-120 días con `validity_days = 15`, anulados `active=false`).
  - Importes calculados en el propio SQL: `neto = spare+labour+other-discount`, `iva = round(neto*0.19)`, `total = neto+iva`. `budget_details.total_amount` no se inserta; tampoco ningún `id`.
  - Idempotencia: cada INSERT es `INSERT ... SELECT ... WHERE NOT EXISTS` por clave natural (budgets por `code` o `budget_number`; detalles solo para `DEV-%` sin detalles) + `ON CONFLICT DO NOTHING`. Envuelto en `BEGIN; ... COMMIT;`. Sin DELETE/TRUNCATE/DROP (grep de esas palabras = 0, también en comentarios).
  - Al final del archivo hay un SELECT de comprobación comentado con los conteos esperados por empresa/estado.
  - Limitación: las fechas se fijan al ejecutar; con el tiempo los vigentes pasan a vencidos y re-ejecutar no los refresca (los presupuestos existentes se omiten).
  - Comprobaciones (repetidas tras el cambio a una sola empresa): validación de sintaxis y tipos ejecutando solo la parte `SELECT` de los 9 INSERT contra la BD (sin errores); tabla de VALUES verificada: estado derivado = estado esperado en las 16 filas e importes coherentes. `tsc --noEmit` ✅, `pnpm lint` ✅ (0 errores, 1 warning preexistente ajeno en `app-shell.tsx`).
  - Para el analista: los criterios de T-004 (y la verificación de T-006, que habla de "ninguno de la empresa B") deberían actualizarse a la decisión de una sola empresa por BD; con este seed, el equivalente es comprobar que no aparecen los presupuestos de `dev.sin.empresa@cotiza.test`. El filtrado sigue siendo vía `budgets.user_id → users.company_id`.
- **Revisión:** 2026-11-01 21:54 · revisor · **aprobada**
  - Criterios "2 empresas" / "repartidos entre las dos empresas": evaluados contra la **decisión vigente del usuario** (una BD = una sola empresa), no contra el texto original: 1 empresa + 2 usuarios con `company_id` + 1 usuario con `company_id` NULL. Cumple.
  - SQL 002 **no ejecutado** (ni con ROLLBACK). Solo SELECT de inspección/validación.
  - Inspección de las 9 tablas (`information_schema.columns`, `pg_constraint`, `pg_indexes`): todas vacías; PK identity ALWAYS en las 9 → el SQL no inserta ningún `id`; `budget_details.total_amount` es GENERATED (`quantity * unit_amount`) y no se inserta. NOT NULL cubiertos (`users.password_hash`='dev-no-login', `role_id` por subconsulta, `budget_details.service_type_id/description/quantity/unit_amount`, `budgets.*`; `users.company_id` es nullable). UNIQUE reales (`companies.rut`, `roles.code`, `users.email`, `clients.rut`, `vehicles.plate`, `service_types.name`, `client_vehicles(client_id,vehicle_id)`, `budgets.code`, `budgets.budget_number`) protegidos por `WHERE NOT EXISTS` sobre esa misma clave + `ON CONFLICT DO NOTHING`. CHECKs respetados: `vehicles.year` 2016-2020 ∈ [1900,2100], `mileage` ≥ 0, importes de budgets ≥ 0 (neto mínimo 45000), `validity_days`=15 > 0, `quantity`=1 > 0, `unit_amount` ≥ 0. Longitudes varchar holgadas (p. ej. `plate` 6/15, `code` 8/30, `description` ≤ 70/255).
  - Idempotencia: 9 INSERT, los 9 con `NOT EXISTS` por clave natural (budgets por `code` OR `budget_number`; budget_details solo para `DEV-%` sin ningún detalle); sin duplicados dentro de los VALUES. Envuelto en `BEGIN; … COMMIT;`, cabecera "SOLO DESARROLLO / opcional". `grep -iE 'delete|truncate|drop|update '` = 0 coincidencias.
  - Validación de sintaxis/tipos: extraídas y ejecutadas solo las partes SELECT de los 9 INSERT → 9/9 sin error (companies 1 fila, roles 1, users 3, clients 3, vehicles 3, service_types 3; client_vehicles/budgets/budget_details 0 por tablas vacías, pero planificadas y tipadas sin error).
  - Simulación sobre la tabla VALUES de budgets (16 filas): estado derivado (`NOT active` → anulado; `date + 15 >= CURRENT_DATE` → vigente; si no, vencido) = estado esperado en 16/16; `neto = spare+labour+other-discount`, `iva = round(neto*0.19)`, `total = neto+iva` en 16/16. Reparto: empresa 4 vigentes / 3 vencidos / 3 anulados; sin empresa 2/2/2. Detalles: 2 líneas + 3ª si `other_charges > 0`; suma = spare+labour+other.
  - `pnpm exec tsc --noEmit` ✅; `pnpm lint` ✅ (0 errores, 1 warning preexistente ajeno en `app/components/app-shell.tsx`); build — (no toca código de la app).
  - Observaciones (no bloqueantes): (a) si la BD de desarrollo ya tuviera otra empresa con distinto `rut`, el seed añadiría una segunda (hoy `companies` está vacía); (b) el filtro `b.code LIKE 'DEV-%'` de los detalles es algo amplio (bastaría la lista DEV-0001..0016); (c) el vigente más antiguo (DEV-0004, 10 días) pasa a vencido 6 días después de ejecutar el seed: conviene ejecutarlo justo antes de verificar T-006/T-007. Los criterios de T-006/T-007 que mencionan "empresa B" deben reinterpretarse como "presupuestos de `dev.sin.empresa@cotiza.test`".

### T-005 · Usuario actual provisional (`getCurrentUser` vía `DEV_USER_ID`)
- **Estado:** en_revision
- **Depende de:** T-002
- **Descripción:** No hay login. Una única función resuelve el usuario actual desde la variable `DEV_USER_ID`; al integrar auth real solo cambia esta función.
- **Criterios de aceptación:**
  - [ ] `lib/auth/current-user.ts` (con `import 'server-only'`) exporta `getCurrentUser(): Promise<{ id: number; name: string; email: string; roleCode: string; companyId: number | null } | null>`.
  - [ ] Devuelve `null` si `DEV_USER_ID` falta, no es numérico, o el usuario no existe / `active = false`.
  - [ ] Comentario `// TODO(auth): provisional hasta tener login`.
  - [ ] `.env.example` (sin secretos) documenta `DATABASE_URL=` y `DEV_USER_ID=`.
  - [ ] **Condición previa:** el usuario aplicó `.harness/sql/002_seed_budgets_dev.sql`; la tarea solo lo comprueba con `SELECT` (p.ej. `SELECT count(*) FROM budgets WHERE code LIKE 'DEV-%'` = 16) y obtiene los ids con `SELECT id, email, company_id FROM users WHERE email LIKE 'dev.%@cotiza.test'`.
  - [ ] Verificación con script desechable en scratchpad: con `DEV_USER_ID` = id de `dev.a1@cotiza.test` (y de `dev.a2@cotiza.test`) devuelve el usuario con `companyId` igual al `id` de la única fila de `companies`; con el id de `dev.sin.empresa@cotiza.test` devuelve el usuario con `companyId: null` (no `null` como usuario); con `DEV_USER_ID` vacío, `abc` o `999999` devuelve `null`. Salidas pegadas en notas.
- **Archivos previstos:** `lib/auth/current-user.ts`, `.env.example`.
- **Notas del analista:** Leer `node_modules/next/dist/docs/01-app/02-guides/authentication.md` y `node_modules/next/dist/docs/01-app/02-guides/data-security.md` (patrón DAL). Con `cacheComponents: true`, no envolver en `'use cache'` nada que dependa del usuario. Si se usa `React.cache` para deduplicar por request, es correcto. `.gitignore` ignora `.env*`: añadir excepción `!.env.example` si hace falta.
- **Notas del desarrollador:**
  - **AVISO: el seed 002 NO está aplicado.** Comprobado con `SELECT`: `count(*) FROM budgets WHERE code LIKE 'DEV-%'` = 0, `users WHERE email LIKE 'dev.%@cotiza.test'` = 0 filas, `users` total = 0, `companies` = 0 filas. Quedan **pendientes del seed** los criterios "Condición previa" y la parte de la verificación con `dev.a1`/`dev.a2` (companyId = id de la única empresa) y `dev.sin.empresa` (companyId: null). El código está implementado; solo falta ejecutar la verificación cuando el usuario aplique `.harness/sql/002_seed_budgets_dev.sql`.
  - Archivos: `lib/auth/current-user.ts` (nuevo), `.env.example` (nuevo; solo `DATABASE_URL=` y `DEV_USER_ID=` vacíos, con comentarios), `.gitignore` (excepción `!.env.example` tras `.env*`; antes `.env.example` quedaba ignorado). `.env` del usuario sin tocar.
  - `getCurrentUser` = `React.cache(async () => …)` (deduplicación por petición, patrón DAL de `data-security.md`; sin `'use cache'`). Exporta también el tipo `CurrentUser` con la forma exigida `{ id, name, email, roleCode, companyId: number | null }`.
  - Parseo de `DEV_USER_ID`: `trim()` + `/^\d+$/` + entero seguro en `1..2147483647` (rango int4, evita error de Postgres "out of range"); si no, `null` sin consultar la BD.
  - Consulta con query builder: `users INNER JOIN roles ON roles.id = users.role_id WHERE users.id = :id AND users.active = true LIMIT 1`. Decisión: al no haber FKs, un usuario con `role_id` inexistente también devuelve `null` (no se puede rellenar `roleCode: string`). Es un caso extra de `null` no listado en los criterios; anotado por si el analista prefiere otro comportamiento.
  - Cómo probar: script de scratchpad (`verify-current-user.mts`) copiado temporalmente a la raíz del proyecto (para resolver `./lib/...`) y ejecutado con `NODE_OPTIONS='--conditions=react-server' node --env-file=.env --import tsx ./.verify-current-user.tmp.mts <valores DEV_USER_ID…>`; cada argumento se asigna a `process.env.DEV_USER_ID` y se llama a `getCurrentUser()` (fuera de una petición `React.cache` no memoiza). Archivo temporal borrado tras ejecutar. Con el seed aplicado, pasar los ids de `dev.a1`, `dev.a2` y `dev.sin.empresa`.
  - Salida (sin seed):
    ```
    seed DEV budgets: [ { n: 0 } ]
    users total: [ { n: 0 } ]
    DEV_USER_ID="<unset>" -> null
    DEV_USER_ID="" -> null
    DEV_USER_ID="abc" -> null
    DEV_USER_ID="999999" -> null
    DEV_USER_ID="-1" -> null
    DEV_USER_ID="1.5" -> null
    DEV_USER_ID="99999999999" -> null
    DEV_USER_ID=" 7 x" -> null
    ```
    (`999999` sí ejecuta la consulta contra la BD y devuelve `null` sin error.)
  - Comprobaciones: `pnpm exec tsc --noEmit` ✅; `pnpm lint` ✅ (0 errores, 1 warning preexistente ajeno en `app/components/app-shell.tsx`).
- **Revisión:** _(vacío)_

### T-006 · Consulta `getCompanyBudgets` y estado derivado (vigente/vencido/anulado)
- **Estado:** pendiente
- **Depende de:** T-003, T-005
- **Descripción:** Capa de lectura del listado (va en `lib/data/`, no en `lib/actions/`, porque no es una mutación). Filtra por la empresa del usuario actual cruzando `budgets.user_id` con `users.company_id`. El estado no existe en BD: se deriva.
- **Criterios de aceptación:**
  - [ ] `lib/budgets/status.ts` exporta el tipo `BudgetStatus = 'vigente' | 'vencido' | 'anulado'` y un mapa a etiqueta/color (`Vigente`/green, `Vencido`/orange, `Anulado`/default). Regla: `active = false` → anulado; si no, `date + validity_days < CURRENT_DATE` → vencido; si no → vigente.
  - [ ] `lib/data/budgets.ts` (`import 'server-only'`) exporta `getCompanyBudgets({ status?, search?, page = 1, pageSize = 10 })` que obtiene el usuario con `getCurrentUser()` y aplica **siempre** `INNER JOIN users ON users.id = budgets.user_id WHERE users.company_id = :companyId` (el companyId nunca viene del cliente).
  - [ ] El estado y la fecha de vencimiento (`date + validity_days`) se calculan en SQL (`CASE ... CURRENT_DATE`) para que filtro y paginación sean consistentes y no dependan de `new Date()` en el render.
  - [ ] Devuelve `{ items, total, page, pageSize }`; cada item: `code`, `budgetNumber`, `date`, `expiresOn`, `status`, `netoAmount`, `ivaAmount`, `totalAmount`, nombre del cliente, `plate`/`brand`/`model` del vehículo y nombre del usuario autor. Orden `date desc, budget_number desc`.
  - [ ] `search` filtra (ILIKE) por `code`, nombre de cliente o patente; `status` inválido se ignora.
  - [ ] Usuario `null` o `companyId null` → `{ items: [], total: 0, ... }` sin consultar budgets.
  - [ ] **Condición previa:** el usuario aplicó `.harness/sql/002_seed_budgets_dev.sql`; la tarea solo lo comprueba con `SELECT` (p.ej. `SELECT count(*) FROM budgets WHERE code LIKE 'DEV-%'` = 16) y obtiene los ids con `SELECT id, email, company_id FROM users WHERE email LIKE 'dev.%@cotiza.test'`.
  - [ ] Verificación (script desechable en scratchpad) con `DEV_USER_ID` = id de `dev.a1@cotiza.test` y `search: 'DEV-'`: `total` = 10 y los `code` devueltos son exactamente `DEV-0001` … `DEV-0010` (incluye los de `dev.a2`, porque se filtra por empresa y no por autor). Con `DEV_USER_ID` de `dev.a2@cotiza.test` el resultado es idéntico.
  - [ ] Ninguno de `DEV-0011` … `DEV-0016` (autor `dev.sin.empresa@cotiza.test`) aparece en ningún caso, ni siquiera buscando por su código (`search: 'DEV-0011'` → `total` = 0).
  - [ ] El estado de cada uno de los 10 coincide fila a fila con la consulta de referencia `SELECT b.code, CASE WHEN NOT b.active THEN 'anulado' WHEN b.date + b.validity_days < CURRENT_DATE THEN 'vencido' ELSE 'vigente' END AS estado FROM budgets b JOIN users u ON u.id = b.user_id WHERE u.company_id = (SELECT company_id FROM users WHERE email = 'dev.a1@cotiza.test') AND b.code LIKE 'DEV-%' ORDER BY b.code`. Con el seed recién aplicado son 4 vigentes, 3 vencidos y 3 anulados. Si han pasado días desde que se aplicó, algún vigente puede haber pasado a vencido: manda la consulta de referencia. `status: 'anulado'` devuelve siempre `DEV-0008`, `DEV-0009`, `DEV-0010`.
  - [ ] Sin `search`, `total` es igual a `SELECT count(*) FROM budgets b JOIN users u ON u.id = b.user_id WHERE u.company_id = <company_id>` (por si la BD tiene presupuestos reales además del seed).
  - [ ] Con `DEV_USER_ID` de `dev.sin.empresa@cotiza.test` → `{ items: [], total: 0 }` (sus 6 presupuestos no se muestran); con `DEV_USER_ID=999999` o sin definir → `{ items: [], total: 0 }`.
  - [ ] `pnpm exec tsc --noEmit` pasa.
- **Archivos previstos:** `lib/data/budgets.ts`, `lib/budgets/status.ts`.
- **Notas del analista:** Leer `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` y `node_modules/next/dist/docs/01-app/02-guides/data-security.md`. Para el estado calculado y el filtro, usar el query builder (`db.select().from(budgets).innerJoin(...)`) con `sql\`...\`` antes que `db.query` relacional. `date + int` en Postgres devuelve `date`. Fechas: devolver como string `YYYY-MM-DD` (modo `string` de la columna `date`) para que sean serializables.
- **Notas del desarrollador:** _(vacío)_
- **Revisión:** _(vacío)_

### T-007 · Página `/budgets` con tabla de presupuestos de mi empresa
- **Estado:** pendiente
- **Depende de:** T-006
- **Descripción:** Sustituir el placeholder de `app/budgets/page.tsx` por el listado real: Server Component que obtiene datos + componente cliente con `antd` `Table`. Término de UI: **"Presupuestos"**.
- **Criterios de aceptación:**
  - [ ] `GET /budgets` responde 200 con título "Presupuestos" y botón "Nuevo presupuesto" que navega a `/budgets/new-budget`.
  - [ ] Columnas: Código (enlace `next/link` a `/budgets/[code]`), N.º, Fecha (dd-mm-aaaa), Vence (dd-mm-aaaa), Cliente, Vehículo (patente · marca modelo), Creado por, Neto, IVA, Total (CLP con `Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })`), Estado (`Tag` según `lib/budgets/status.ts`).
  - [ ] **Condición previa:** el usuario aplicó `.harness/sql/002_seed_budgets_dev.sql`; la tarea solo lo comprueba con `SELECT` (p.ej. `SELECT count(*) FROM budgets WHERE code LIKE 'DEV-%'` = 16) y obtiene los ids con `SELECT id, email, company_id FROM users WHERE email LIKE 'dev.%@cotiza.test'`.
  - [ ] Con `DEV_USER_ID` = id de `dev.a1@cotiza.test`, la tabla muestra los 10 presupuestos `DEV-0001` … `DEV-0010` (los de `dev.a1` y `dev.a2`, con la columna "Creado por" correspondiente) y ninguno de `DEV-0011` … `DEV-0016`. Si la BD tiene además presupuestos reales de la empresa, el total de la paginación coincide con el `count(*)` por empresa de T-006.
  - [ ] Los `Tag` de estado de esos 10 coinciden con la consulta de referencia de T-006 (4 vigentes, 3 vencidos, 3 anulados con el seed recién aplicado). Los importes de `DEV-0001` coinciden con `SELECT neto_amount, iva_amount, total_amount FROM budgets WHERE code = 'DEV-0001'`, formateados en CLP.
  - [ ] Sin errores de hidratación en consola; `pnpm build` pasa.
- **Archivos previstos:** `app/budgets/page.tsx`, `app/budgets/_components/budgets-table.tsx`, `lib/format.ts` (moneda/fecha).
- **Notas del analista:** `cacheComponents: true` activo: el acceso a datos dinámicos (usuario, `searchParams`) debe ir dentro de `<Suspense>` o la build falla. Leer `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` y `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`. Pasar al cliente solo datos serializables. Formatear fechas `YYYY-MM-DD` por string (sin `new Date()` con zona horaria) para evitar desfases de un día.
- **Notas del desarrollador:** _(vacío)_
- **Revisión:** _(vacío)_

### T-008 · Filtros, búsqueda y paginación por `searchParams`
- **Estado:** pendiente
- **Depende de:** T-007
- **Descripción:** Filtrar por estado derivado, buscar texto y paginar, reflejado en la URL.
- **Criterios de aceptación:**
  - [ ] **Condición previa:** el usuario aplicó `.harness/sql/002_seed_budgets_dev.sql`; la tarea solo lo comprueba con `SELECT` (p.ej. `SELECT count(*) FROM budgets WHERE code LIKE 'DEV-%'` = 16) y obtiene los ids con `SELECT id, email, company_id FROM users WHERE email LIKE 'dev.%@cotiza.test'`. Todas las comprobaciones con `DEV_USER_ID` = id de `dev.a1@cotiza.test`.
  - [ ] `/budgets?q=DEV-&status=anulado` muestra exactamente `DEV-0008`, `DEV-0009`, `DEV-0010`. `?q=DEV-&status=vencido` y `?q=DEV-&status=vigente` muestran exactamente los códigos que la consulta de referencia de T-006 da para ese estado (3 y 4 con el seed recién aplicado).
  - [ ] `/budgets?q=DEVA11` (patente) muestra exactamente `DEV-0001`, `DEV-0004`, `DEV-0007`, `DEV-0010`, y no `DEV-0013` ni `DEV-0016`, que son del usuario sin empresa y tienen la misma patente. La búsqueda por nombre de cliente funciona igual: no aparece ningún `DEV-0011` … `DEV-0016`.
  - [ ] `/budgets?q=DEV-` muestra 10 filas en una sola página (total 10). `/budgets?q=DEV-&page=2` muestra el estado "Sin resultados" de T-009 (o una tabla vacía si T-009 aún no está hecha) sin error. Sin `q`, el número de páginas corresponde al `count(*)` por empresa con 10 por página.
  - [ ] Barra con `Select` de estado (Todos/Vigente/Vencido/Anulado) e `Input.Search`; al cambiar actualiza la URL y resetea `page` a 1.
  - [ ] La paginación de la `Table` muestra el total real y cambia `?page=`.
  - [ ] Parámetros inválidos (`page=abc`, `status=foo`) no rompen la página.
- **Archivos previstos:** `app/budgets/page.tsx`, `app/budgets/_components/budgets-filters.tsx`, `app/budgets/_components/budgets-table.tsx`.
- **Notas del analista:** `searchParams` es una Promise en `page.tsx` (`PageProps<'/budgets'>`). Leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`, `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` y `use-router.md`. Considerar `useTransition` para feedback de carga.
- **Notas del desarrollador:** _(vacío)_
- **Revisión:** _(vacío)_

### T-009 · Estados de carga, error y vacío en `/budgets`
- **Estado:** pendiente
- **Depende de:** T-007
- **Descripción:** Cubrir los estados no felices del listado.
- **Criterios de aceptación:**
  - [ ] Mientras carga se ve `Skeleton` o `Table loading` (fallback de `Suspense` o `app/budgets/loading.tsx`).
  - [ ] Si la consulta falla, `app/budgets/error.tsx` muestra mensaje en español y botón "Reintentar".
  - [ ] Sin resultados: `Empty` de antd "Tu empresa aún no tiene presupuestos" con CTA a `/budgets/new-budget` (o "Sin resultados para los filtros" si hay filtros activos).
  - [ ] **Condición previa:** el usuario aplicó `.harness/sql/002_seed_budgets_dev.sql`; la tarea solo lo comprueba con `SELECT` (p.ej. `SELECT count(*) FROM budgets WHERE code LIKE 'DEV-%'` = 16) y obtiene los ids con `SELECT id, email, company_id FROM users WHERE email LIKE 'dev.%@cotiza.test'`.
  - [ ] Sin usuario actual (`DEV_USER_ID` sin definir o `999999`): `Alert` "No hay usuario actual" en lugar de la tabla, sin errores.
  - [ ] Usuario sin empresa (`DEV_USER_ID` = id de `dev.sin.empresa@cotiza.test`): `Alert` que indica que el usuario no tiene empresa asignada, en lugar de la tabla. No aparece ninguno de sus 6 presupuestos (`DEV-0011` … `DEV-0016`) ni ninguno de la empresa.
  - [ ] Con `dev.a1@cotiza.test`, `/budgets?q=NO-EXISTE` muestra "Sin resultados para los filtros". El mensaje "Tu empresa aún no tiene presupuestos" no se puede provocar sin borrar datos, así que se verifica revisando el código: se muestra cuando `total = 0` y no hay filtros.
- **Archivos previstos:** `app/budgets/loading.tsx`, `app/budgets/error.tsx`, `app/budgets/_components/budgets-table.tsx`.
- **Notas del analista:** Leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`, `error.md` y `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md` (la firma de `error.tsx` puede diferir de versiones anteriores). Para distinguir "sin usuario" de "sin empresa", `getCompanyBudgets` puede devolver un campo `reason`.
- **Notas del desarrollador:** _(vacío)_
- **Revisión:** _(vacío)_

### T-010 · Navegación del menú lateral hacia rutas reales
- **Estado:** en_revision
- **Depende de:** —
- **Descripción:** El `Menu` de `app/components/app-shell.tsx` no navega y tiene `defaultSelectedKeys` fijos. Cada ítem debe llevar a su ruta y el activo depender de la URL.
- **Criterios de aceptación:**
  - [x] "Presupuestos" → `/budgets`, "Clientes" → `/clients`, "Vehículos" → `/vehicles`, "Inicio" → `/`.
  - [x] Ítem seleccionado derivado de `usePathname()` (en `/budgets/ABC-1` queda marcado "Presupuestos").
  - [ ] Sin errores de consola; `pnpm build` pasa.
- **Archivos previstos:** `app/components/app-shell.tsx`.
- **Notas del analista:** Leer `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-pathname.md` y `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`. El `AppShell` ya está bajo el `Suspense` de `app/layout.tsx`. Mantener el texto "Presupuestos".
- **Notas del desarrollador:**
  - Archivo: `app/components/app-shell.tsx` (único). Se conserva el trabajo previo del usuario: el `Menu` horizontal del `Header` (items vacíos, `defaultSelectedKeys={["2"]}`) queda intacto, igual que el import `ChevronDownIcon` (origen del warning de lint preexistente). `app/layout.tsx` y `app/page.tsx` no se tocan.
  - Menú lateral: constante `NAV_ITEMS` (`/` Inicio, `/budgets` Presupuestos, `/clients` Clientes, `/vehicles` Vehículos) con la ruta como `key`; cada `label` es un `next/link` `<Link href>` (navegación cliente con prefetch). Se quitan `defaultSelectedKeys`/`defaultOpenKeys` (no hay submenús) y se usa `selectedKeys` controlado.
  - Selección: `usePathname()` + `getSelectedNavKey`: `/` solo coincide exacto; el resto por `pathname === href || pathname.startsWith(href + "/")` (evita que p. ej. `/budgets-x` marque Presupuestos). Ruta sin coincidencia → ningún ítem seleccionado.
  - `cacheComponents: true`: según `use-pathname.md`, `usePathname` suspende en rutas con params dinámicos sin `generateStaticParams`; el `AppShell` ya está dentro del `<Suspense>` de `app/layout.tsx`, así que no hizo falta añadir otro. La build lo confirma (rutas `[budgetCode]`, `[clientId]`, `[vehicleId]` como `◐` sin error).
  - Comprobaciones: `pnpm exec tsc --noEmit` OK; `pnpm lint` 0 errores (1 warning preexistente `ChevronDownIcon`); `pnpm build` OK (13 rutas). Con el `next dev` en marcha (puerto 3000), HTML SSR: `/` → seleccionado `/`; `/budgets` y `/budgets/ABC-1` → `/budgets`; `/clients/5` → `/clients`; `/vehicles/new-vehicle` → `/vehicles`; los 4 enlaces `<a href>` presentes. No pude abrir un navegador para revisar la consola del cliente: el revisor debería comprobar en el navegador que no hay errores/hidratación y que el clic navega sin recarga.
- **Revisión:** 2026-11-01 22:02 · revisor · pendiente de navegador (sin defectos encontrados)
  - Pendiente: verificación en navegador (consola/hidratación). Es lo único que falta; el criterio 3 queda sin marcar solo por eso (`pnpm build` sí pasa).
  - `pnpm exec tsc --noEmit` → OK; `pnpm lint` → 0 errores (1 warning previo del usuario: `ChevronDownIcon` sin usar); `pnpm build` → OK (13 rutas, `[budgetCode]`/`[clientId]`/`[vehicleId]` como `◐`).
  - Alcance: los cambios de T-010 están solo en el `Sider` de `app/components/app-shell.tsx` (`NAV_ITEMS`, `getSelectedNavKey`, `usePathname`, `selectedKeys` controlado, `<Link>` en las etiquetas). El `Menu` del `Header` y `ChevronDownIcon` son del usuario y no se tocan.
  - Funcional (HTML SSR de `next dev`; no se puede arrancar un segundo `next dev` en el mismo directorio, "Another next dev server is already running", así que se leyó con GET el del usuario en el 3000 sin detenerlo): `/` 200 → seleccionado `Inicio`; `/budgets` 200 y `/budgets/ABC-1` 200 → `Presupuestos`; `/clients/5` 200 → `Clientes`; `/vehicles/new-vehicle` 200 → `Vehículos`; `/budgets-x` 404 → ninguno seleccionado. En todas aparecen los 4 enlaces `<a href="/">Inicio`, `/budgets` Presupuestos, `/clients` Clientes, `/vehicles` Vehículos.
  - Hidratación (revisión de código): `selectedKeys` depende solo de `usePathname()`, que vale lo mismo en servidor y cliente. No hay `window`, `Date`, `Math.random` ni ramas solo de cliente. `NAV_ITEMS` es una constante del módulo. No se ve ninguna causa de mismatch.
  - Observación previa, NO atribuible a T-010: con `next start` (build de producción, puerto 3123) el HTML SSR no incluye el shell, solo el fallback `<main>` del `<Suspense>` de `app/layout.tsx` y `<template id="B:0">`; el shell se pinta en el cliente. Se repitió en una copia temporal con `usePathname()` sustituido por una constante y el resultado fue el mismo (0 apariciones de "Presupuestos"), así que lo causa el montaje `Suspense`/`AntdRegistry` del usuario y no esta tarea. Conviene abrir una tarea aparte si se quiere el shell en el SSR de producción.
