import type { DisabledFilters } from "../types";
import {
  DbOperator,
  FieldQuery,
  QueryValue,
  QueryValueWithOperator,
} from "../db/types";
import { DB_OPERATORS, VALUELESS_OPERATORS } from "../db/constants";

/** Query-string keys that control pagination rather than filtering. */
const RESERVED_KEYS = new Set(["limit", "offset"]);
const DEFAULT_LIMIT = 100;
const DEFAULT_OFFSET = 0;

export interface ParsedListQuery {
  queryFields: FieldQuery;
  limit: number;
  offset: number;
}

/**
 * Translate a raw Express `req.query` into the structured `FieldQuery` the DB
 * layer understands, plus pagination. This is the HTTP → DB boundary: it owns
 * all URL-string concerns (operator suffixes, reserved keys, empty values) and
 * enforces the route's opt-out `disabledFilters` policy. It performs NO SQL and
 * does not validate field names against the model — that (the injection guard)
 * is the DB layer's job.
 */
export function parseListQuery(
  query: Record<string, unknown>,
  disabledFilters: DisabledFilters = {},
): ParsedListQuery {
  const queryFields: FieldQuery = {};

  for (const key of Object.keys(query)) {
    if (RESERVED_KEYS.has(key)) {
      continue;
    }

    const parts = key.split("__");
    if (parts.length > 2) {
      throw new Error(`Invalid query parameter: ${key}`);
    }

    const fieldName = parts[0];
    const hasOperator = parts.length === 2;
    const operator = (hasOperator ? parts[1] : "eq") as DbOperator;

    if (hasOperator && !DB_OPERATORS.includes(operator)) {
      throw new Error(`Invalid query parameter: ${key}`);
    }

    assertFilterEnabled(fieldName, operator, disabledFilters, key);

    // Value-less operators (`?field__is_null`) carry no value.
    if (VALUELESS_OPERATORS.includes(operator)) {
      assignOperator(queryFields, fieldName, operator, true);
      continue;
    }

    const rawValue = query[key];

    // Ignore empty filters (`?name=`) rather than matching the empty string.
    if (rawValue === undefined || rawValue === "") {
      continue;
    }

    if (operator === "in") {
      const values: QueryValue[] = Array.isArray(rawValue)
        ? (rawValue as unknown[]).map((v) => String(v))
        : String(rawValue).split(",");
      assignOperator(queryFields, fieldName, operator, values);
      continue;
    }

    const value = String(rawValue);
    if (hasOperator) {
      assignOperator(queryFields, fieldName, operator, value);
    } else {
      // Plain `?field=value` is stored as a scalar equality.
      queryFields[fieldName] = value;
    }
  }

  const limit = query.limit ? parseInt(String(query.limit), 10) : DEFAULT_LIMIT;
  const offset = query.offset
    ? parseInt(String(query.offset), 10)
    : DEFAULT_OFFSET;

  return { queryFields, limit, offset };
}

/**
 * Enforce the opt-out policy: everything is filterable unless `disabledFilters`
 * turns it off, either at the whole-field level (`field: false`) or for a
 * single operator (`field: { contains: false }`).
 */
function assertFilterEnabled(
  fieldName: string,
  operator: DbOperator,
  disabledFilters: DisabledFilters,
  key: string,
): void {
  const config = disabledFilters?.[fieldName];
  if (config === false) {
    throw new Error(`Invalid query parameter: ${key}`);
  }
  if (config && typeof config === "object" && config[operator] === false) {
    throw new Error(`Invalid query parameter: ${key}`);
  }
}

/** Set one operator on a field, preserving any operators already parsed. */
function assignOperator(
  queryFields: FieldQuery,
  fieldName: string,
  operator: DbOperator,
  value: QueryValue | QueryValue[] | boolean,
): void {
  const existing = queryFields[fieldName];
  const target: QueryValueWithOperator =
    existing && typeof existing === "object" && !(existing instanceof Date)
      ? (existing as QueryValueWithOperator)
      : {};
  // `operator` is a validated key of QueryValueWithOperator; the value union is
  // wider than any single slot, so one localized cast is needed here.
  (target as Record<string, unknown>)[operator] = value;
  queryFields[fieldName] = target;
}
