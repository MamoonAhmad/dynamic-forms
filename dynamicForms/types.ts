import type { Pool } from "pg";
import { DBObject } from "./db/types";

export interface ModelField {
  id: string;
  name: string;
  type: string;
  primaryKey?: boolean;
  autoIncrement?: boolean;
  required?: boolean;
  autoInsert?: boolean;
}

export interface Model {
  name: string;
  fields: ModelField[];
  dbTable?: string;
  description?: string;
}

export type HttpMethod = "CREATE" | "LIST" | "GET" | "UPDATE" | "DELETE";

/**
 * Query configuration for a single field. Can be:
 *  - a boolean (enable/disable plain equality queries)
 *  - a map of operator -> boolean (enable/disable specific operators)
 *  - a custom query object ({ query: FieldQuery })
 */
export type QueryFieldConfig =
  | boolean
  | { [operator: string]: boolean }
  | { query: FieldQuery };

export type QueryFields = Record<string, QueryFieldConfig | undefined>;

export interface RouteConfig {
  path: string;
  methods?: HttpMethod[];
  model: string;
  listFields: string[];
  queryFields: QueryFields;
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
  models: Record<string, Model>;
  backend: BackendConfig;
}

/** Runtime application state: the loaded config plus lazily initialized resources. */
export interface AppState extends AppConfig {
  db: DBObject;
}

/** Raw HTTP query string parameters (Express req.query). */
export type QueryParams = Record<string, unknown>;

/** Nested query object supported by createFieldQuery (AND/OR groups, operators, values). */
export interface FieldQuery {
  [key: string]: FieldQuery[] | Record<string, unknown> | unknown;
}
