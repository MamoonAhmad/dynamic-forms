import { DbOperator } from "./types";

export const DB_OPERATORS = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "contains",
  "is_null",
  "is_not_null",
] as DbOperator[];

/** Operators that take no value (presence-only, e.g. `?field__is_null`). */
export const VALUELESS_OPERATORS = ["is_null", "is_not_null"] as DbOperator[];



export const DB_TYPE_POSTGRES = 'postgres';
export const SUPPORTED_DB_TYPES = [
  DB_TYPE_POSTGRES
]
