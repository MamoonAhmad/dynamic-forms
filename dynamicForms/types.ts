import type { Pool } from "pg";
import { DBObject, Model } from "./db/types";


export type HttpMethod = "CREATE" | "LIST" | "GET" | "UPDATE" | "DELETE";

/**
 * Filter configuration for a single field. Filtering is OPT-OUT: every model
 * column is queryable with every operator by default, and this config only
 * exists to DISABLE things. Can be:
 *  - `false` — disable filtering on the field entirely.
 *  - a map of operator -> boolean — set an operator to `false` to disable just
 *    that operator (e.g. `{ contains: false }`). Plain `?field=value` counts as
 *    the `eq` operator, so `{ eq: false }` disables it too. `true`/omitted =
 *    enabled (the default), so you never need to list operators to turn on.
 *
 * A field with no entry in `disabledFilters` at all is fully queryable.
 */
export type DisabledFilterConfig =
  | boolean
  | { [operator: string]: boolean };

export type DisabledFilters = Record<string, DisabledFilterConfig | undefined>;

export interface RouteConfig {
  path: string;
  methods?: HttpMethod[];
  model: string;
  listFields: string[];
  disabledFilters: DisabledFilters;
}

export interface DatabaseConfig {
  type: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

export interface BackendConfig {
  apiRoutes: RouteConfig[];
  database: DatabaseConfig;
}

export interface AppConfig {
  models: Model[];
  backend: BackendConfig;
}

/** Runtime application state: the loaded config plus lazily initialized resources. */
export interface AppState extends AppConfig {
  db: DBObject;
}

