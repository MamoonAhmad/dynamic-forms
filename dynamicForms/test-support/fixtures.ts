import type { Model } from "../types";

/**
 * A representative model used across the DB tests. Includes a numeric field
 * (`price`) for operator tests and a would-be-sensitive field (`secret`) that
 * is deliberately NOT listed in most `queryFields` configs, to exercise the
 * exposure boundary.
 */
export const customerModel: Model = {
  name: "Customer",
  dbTable: "customer",
  fields: [
    { id: "1", name: "id", type: "number", primaryKey: true, autoIncrement: true },
    { id: "2", name: "firstName", type: "string", required: true },
    { id: "3", name: "lastName", type: "string", required: true },
    { id: "4", name: "email", type: "string", required: true },
    { id: "5", name: "price", type: "number" },
    { id: "6", name: "secret", type: "string" },
  ],
};

export const customerListFields = ["id", "firstName", "lastName", "email", "price"];

/**
 * A model whose `name` is reused as the table (no `dbTable`), to prove the
 * fallback table name is also escaped.
 */
export const noDbTableModel: Model = {
  name: "weird table",
  fields: [
    { id: "1", name: "id", type: "number", primaryKey: true },
    { id: "2", name: "value", type: "string" },
  ],
};

/**
 * Classic SQL-injection payloads used as *values*. Every one of these must end
 * up inside a properly escaped string literal, never as executable SQL.
 */
export const INJECTION_VALUES: string[] = [
  "1 OR 1=1",
  "1; DROP TABLE customer;--",
  "' OR '1'='1",
  "x'); DROP TABLE customer;--",
  '" OR ""="',
  "1' UNION SELECT * FROM users--",
  "admin'--",
  "'||(SELECT password FROM users)||'",
  "\\'; DROP TABLE customer; --",
  "Robert'); DROP TABLE students;--",
];

/**
 * Injection payloads used as *query-parameter names* (identifiers). Every one
 * of these must be rejected by the field whitelist before any SQL is built.
 */
export const INJECTION_KEYS: string[] = [
  'id" = 1 OR "1"="1',
  'firstName"; DROP TABLE customer;--',
  "1=1",
  '"',
  "id') OR ('1'='1",
  "id; DROP TABLE customer",
  "firstName)",
  "*",
];

/**
 * Real-but-unexposed / non-existent columns. These are not injection per se but
 * must also be rejected (they aren't declared model fields).
 */
export const UNKNOWN_COLUMNS: string[] = ["password", "ssn", "nonexistent", "admin"];
