# Dynamic Forms

A config-driven CRUD API generator. You declare **models**, **API routes**, and a **database** in a single `appConfig.json`, and the backend auto-wires Express routes to Postgres. Conceptually similar to Django / PostgREST, with a goal of **near-zero code** to stand up a data-backed REST API.

> **Status:** early / experimental. The core request → validate → SQL loop works, but there are known security bugs (see [Known Bugs](#known-bugs)) and large feature gaps (see [Gaps & Unsupported Use Cases](#gaps--unsupported-use-cases)). Do **not** run against untrusted input or in production yet.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Request Lifecycle](#request-lifecycle)
- [Known Bugs](#known-bugs)
- [Gaps & Unsupported Use Cases](#gaps--unsupported-use-cases)
- [Roadmap / Priorities](#roadmap--priorities)

---

## Quick Start

```bash
cd backend
npm install
# create a .env with the DB vars referenced by appConfig.json (see below)
npm run dev      # tsx watch index.ts
```

The server listens on port `3000`. Tables are **not** created for you — they must already exist in the database (see [Gap: no migrations](#data-modeling)).

### Scripts

| Script            | Description                        |
| ----------------- | ---------------------------------- |
| `npm start`       | `tsx index.ts`                     |
| `npm run dev`     | `tsx watch index.ts` (hot reload)  |
| `npm run typecheck` | `tsc`                            |

---

## Configuration

Everything is driven by `backend/appConfig.json`, which has two top-level keys: `models` and `backend`.

### Models

Each model declares its fields. Example:

```json
"Customer": {
  "name": "Customer",
  "fields": [
    { "id": "1", "name": "id",        "type": "number", "primaryKey": true, "autoIncrement": true },
    { "id": "2", "name": "firstName", "type": "string", "required": true },
    { "id": "6", "name": "createdAt", "type": "date",   "autoInsert": true }
  ],
  "dbTable": "customer",
  "description": "Customer model"
}
```

Field flags: `primaryKey`, `autoIncrement`, `required`, `autoInsert`.

> ⚠️ **Most field metadata is currently decorative.** `type`, `primaryKey`, `autoIncrement`, and `autoInsert` are **not** enforced or acted upon by the code — see [Gaps](#data-modeling). Only `required` and `name` are actually used.

### Routes

Each route maps a URL path to a model and a set of HTTP methods:

```json
{
  "path": "/api/v1/products",
  "methods": ["CREATE", "LIST", "GET", "UPDATE", "DELETE"],
  "model": "Product",
  "listFields": ["id", "name", "price", "description", "createdAt", "updatedAt"],
  "queryFields": {
    "name": true,
    "price": { "gte": true, "lte": true, "eq": true },
    "description": true
  }
}
```

- `methods` → generated endpoints (see mapping below).
- `listFields` → columns returned by LIST / GET.
- `queryFields` → which fields (and operators) are filterable in LIST.

Method → endpoint mapping:

| Method   | HTTP + Path            | Handler factory        |
| -------- | ---------------------- | ---------------------- |
| `CREATE` | `POST /path`           | `models/saveModel.ts`  |
| `LIST`   | `GET /path`            | `models/listModel.ts`  |
| `GET`    | `GET /path/:id`        | `models/getModel.ts`   |
| `UPDATE` | `PUT /path/:id`        | `models/updateModel.ts`|
| `DELETE` | `DELETE /path/:id`     | `models/deleteModel.ts`|

### LIST query syntax

- Equality: `?name=Widget`
- Operators via `field__operator`: `?price__gte=10&price__lte=100`
- Supported operators: `lte`, `gte`, `lt`, `gt`, `is_null`, `is_not_null`, `contains`
- Pagination: `?page=1&perPage=10` (offset-based)

Response shape for LIST:

```json
{ "data": [ ... ], "total": <count>, "resultCount": <rows returned> }
```

### Database

```json
"database": {
  "type": "postgres",
  "host": "DB_HOST", "port": "DB_PORT", "user": "DB_USER",
  "password": "DB_PASSWORD", "database": "DB_NAME"
}
```

The values are **names of environment variables**, resolved at boot via `process.env`. So `"host": "DB_HOST"` means "read the host from `process.env.DB_HOST`". Set these in `backend/.env`.

> ⚠️ `type` is currently ignored — the loader always builds a Postgres pool.

---

## Architecture

```
backend/
├── index.ts                      # Express bootstrap: load config, init app, listen
├── appConfig.json                # THE config: models + routes + database
└── dynamicForms/
    ├── index.ts                  # initializeApplication(): state → db → routes
    ├── appState.ts               # in-memory app state + getModelByName()
    ├── types.ts                  # Model, RouteConfig, AppConfig, QueryFields, ...
    ├── apiRoutes/
    │   └── index.ts              # registerApplicationRoutes(): maps methods → handler factories
    ├── models/                   # HTTP-layer handler factories (one per operation)
    │   ├── saveModel.ts          #   validate + res, returns Express handler
    │   ├── updateModel.ts
    │   ├── getModel.ts
    │   ├── listModel.ts
    │   ├── deleteModel.ts
    │   └── ModelNotFound.ts      # ModelNotFoundError
    └── db/
        ├── types.ts              # DBObject interface (queryModel, getModelById, ...)
        ├── assertDbPresent.ts
        └── postgres/             # Postgres implementation of DBObject
            ├── index.ts          # pool creation + executeQuery() + DBObject wiring
            ├── queryModel.ts     # LIST → SELECT ... WHERE ... LIMIT/OFFSET
            ├── getModelById.ts   # GET
            ├── saveModel.ts      # CREATE → INSERT ... RETURNING
            ├── updateModel.ts    # UPDATE
            ├── deleteModel.ts    # DELETE
            └── escapeQueryValue.ts
```

### Layers

1. **Bootstrap** (`index.ts` → `dynamicForms/index.ts`) — reads `appConfig.json`, calls `initializeAppState`, `loadDatabase`, then `registerApplicationRoutes`. Route registration is async and awaited before `app.listen`.

2. **App state** (`appState.ts`) — a module-level singleton holding the parsed config plus the live `db` object. `getModelByName` resolves a model from config.

3. **HTTP layer** (`models/*.ts`) — each file exports a **handler factory** in a consistent format:

   ```ts
   export async function saveModel(modelName: string) {
     return async (req: Request, res: Response) => {
       const model = getModelByName(modelName);
       const db = getAppState().db!;
       // validate, call db, respond via res
     };
   }
   ```

   Factories resolve `appState`/`model`/`db` internally, validate input, call the DB abstraction, and respond directly through `res`. Because the factories are `async`, the router `await`s them during registration.

4. **DB abstraction** (`db/types.ts` — `DBObject`) — a narrow interface (`queryModel`, `getModelById`, `saveModel`, `updateModel`, `deleteModel`). This is the seam intended to support multiple databases.

5. **Postgres driver** (`db/postgres/*`) — the only implementation. Builds SQL strings and runs them through a shared `executeQuery()` on a `pg.Pool`.

### Design intent

The `DBObject` seam is the key abstraction: the HTTP layer never knows it's talking to Postgres. Swapping databases *should* be a matter of providing another `DBObject` implementation and honoring `database.type`.

---

## Request Lifecycle

**CREATE** (`POST /api/v1/customers`)
1. Router invokes the `saveModel` handler.
2. `validateData` checks `required` fields, builds `validatedData` (only fields present in the body).
3. On validation error → `400 { success: false, errors }`.
4. `db.saveModel` → `INSERT ... RETURNING` → returns the created row.

**UPDATE** (`PUT /api/v1/customers/:id`)
1. Existence check via `db.getModelById(model, id, ["id"])`; `ModelNotFoundError` → `404`.
2. `validateData` (same rules as create) → `400` on error.
3. `db.updateModel` then a fresh `db.getModelById` to return the updated row (**two separate queries, not transactional**).

**LIST / GET / DELETE** follow the same shape: resolve model → call the DB method → map `ModelNotFoundError` to `404`, other errors to `500`.

---

## Known Bugs

Ordered by severity. These are **live** in the current code.

### 🔴 Critical — Security

| # | Bug | Location |
| - | --- | -------- |
| B1 | **SQL injection via query-param *names*.** LIST pushes `"${fieldKey}" = ...` for any request key. The value is escaped but the **identifier is not** and is user-controlled, so a key containing `"` breaks out of the quoted identifier. | `db/postgres/queryModel.ts:84` (also `:74`, raw table name `:92-93`) |
| B2 | **SQL injection via `id` in UPDATE.** `WHERE id = ${id}` interpolates `id` **unescaped**. `getModelById` and `deleteModel` escape it; update does not. `PUT /customers/1 OR 1=1` updates every row. | `db/postgres/updateModel.ts:13` |
| B3 | **`queryFields` operator whitelist is inverted (acts as a blacklist).** `qf?.[field]?.[operator] !== false` allows an operator unless explicitly `false`, so any operator on any listed field is permitted. | `db/postgres/queryModel.ts:37` |
| B4 | **Filtering bypasses `queryFields` entirely.** Unknown keys fall through to `=`, so clients can filter on columns never exposed in config (e.g. `?password=...`) — enumeration / info-disclosure vector. | `db/postgres/queryModel.ts:83-85` |
| B5 | **Raw DB errors leaked to clients.** Handlers return `error.message` / `error.toString()`, exposing Postgres internals (table/column/constraint names). | all `models/*.ts` and `db/postgres/*.ts` |

### 🟠 Correctness

| # | Bug | Location |
| - | --- | -------- |
| B6 | **No `ORDER BY`.** LIST never orders results, so offset pagination is non-deterministic across pages. | `db/postgres/queryModel.ts:92` |
| B7 | **`config.eq` operator is broken.** `eq` is accepted by the gate but has no `case` in the `switch`, so `price__eq=...` throws `Invalid operator: eq`. | `db/postgres/queryModel.ts:40-64` |
| B8 | **`total` type mismatch.** Typed as `number` but Postgres `count(*)` returns a string. | `db/postgres/queryModel.ts:113` |
| B9 | **Falsy-value validation.** `validateData` uses `!data[field.name]`, so `0`, `false`, and `""` are treated as "missing" for required fields. | `models/saveModel.ts`, `models/updateModel.ts` |
| B10 | **`validateData` duplicated** across `saveModel.ts` and `updateModel.ts` — should be shared. | `models/*.ts` |

### 🟡 Minor / cleanup

| # | Bug | Location |
| - | --- | -------- |
| B11 | **No config validation at boot.** A route referencing a missing model → `getModelByName` returns `undefined` → crash at request time, not startup. `initializeAppState` has a `// TODO: validate`. | `appState.ts:19` |
| B12 | **`database.type` ignored.** `loadDatabase` always builds a `pg.Pool`. | `db/postgres/index.ts` |
| B13 | **`assertDbPresent` is unused.** | `db/assertDbPresent.ts` |

---

## Gaps & Unsupported Use Cases

What this system **cannot** do today. This is intentionally exhaustive — it's the backlog.

### Data modeling

- **No migrations / schema generation.** Tables must already exist; you still hand-write DDL. Not truly "no-code" yet.
- **Field metadata is decorative.** `type`, `primaryKey`, `autoIncrement`, `autoInsert` are not enforced. `type: "number"` doesn't coerce or validate; `autoInsert` never populates `createdAt`; `updatedAt` is never auto-set.
- **`id` is hardcoded as the primary key** in GET/UPDATE/DELETE. Non-`id` or composite keys unsupported despite the `primaryKey` flag existing.
- **No relationships** — foreign keys, one-to-many, many-to-many, joins. Can't express `Customer hasMany Orders`.
- **No nested / related serialization** (Django `select_related` / `prefetch_related`).
- **Limited field types** — no enum/choices, JSON/JSONB, arrays, decimal/money precision, UUID, text vs varchar, file/binary, geo.
- **No validation beyond `required`** — no max length, regex/format (email), min/max, `unique`, choices.
- **No default values, computed/derived fields, or auto timestamps.**
- **No nullable-vs-required distinction** (only truthiness is checked).

### API / querying

- **No sorting / `ORDER BY`.**
- **No cursor pagination**, only offset. No per-request field selection.
- **No top-level `OR`** via query params (only `AND`).
- **No full-text search, aggregation, grouping, counts, or analytics endpoints.**
- **No bulk create / update / delete.**
- **No true PATCH.** UPDATE re-validates all `required` fields, so single-field updates require resending the rest.
- **No nested writes** (create Customer + Orders in one call).

### Auth / permissions / multi-tenancy

- **No authentication** (users, sessions, JWT, API keys).
- **No authorization** — per-model, per-row, or per-field. Everyone can CRUD everything.
- **No row ownership / multi-tenant scoping.**
- **No field-level read/write control** (hide `email`, make `createdAt` read-only).
- **CORS wide open**, no rate limiting, no request-size limits.

### Business logic

- **No lifecycle hooks / signals** (pre-save, post-save, validation hooks).
- **No custom endpoints or actions** (Django `@action`). Fixed CRUD only.
- **No transactions.** UPDATE does `update` then a separate `get` — not atomic.
- **No async / cross-field validation** (e.g. uniqueness check against DB).
- **No serializer-style response transforms.**

### Data integrity / ops

- **No app-level unique enforcement** or friendly constraint-error mapping.
- **No soft deletes, no audit log.**
- **No caching, background jobs, webhooks/events, or email.**
- **No admin UI** (Django admin), **no file uploads** (JSON body only), **no i18n.**
- **No OpenAPI/Swagger generation, no health check, no tests.**
- **Single database** — only Postgres is implemented despite the `DBObject` seam.

---

## Roadmap / Priorities

Suggested order (security first, then the pillars that make it genuinely low-code):

1. **Close injection holes & fix the operator whitelist** (B1–B4). Validate every identifier against `model.fields` and switch to **parameterized queries** (`$1`) — this deletes `escapeQueryValue` entirely.
2. **Add `ORDER BY`** (default to PK) so pagination is correct (B6).
3. **Stop leaking raw DB errors** (B5) and **validate config at boot** (B11).
4. **Make field metadata real** — `type` coercion/validation, auto `createdAt`/`updatedAt`, honor `primaryKey`. Biggest step toward true no-code.
5. **Schema generation / migrations** from the model config.
6. **Auth + per-model/-field permissions** as config — the largest missing pillar vs. Django.
7. **Relationships** — hardest, but unlocks real applications.

> Keep this file honest: when a bug is fixed or a gap is closed, move it out of the tables above and note it here so we retain the track record.
