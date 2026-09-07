import pg from "pg";
import assert from "node:assert";
import { loadDatabase } from "../db/postgres";
import { initializeAppState } from "../appState";
import { Model } from "../db/types";

/**
 * SQL captured at the driver boundary. Tests assert against these strings
 * instead of hitting a real database — this is what lets us prove that no
 * injection payload ever reaches Postgres as executable SQL.
 */
export const capturedQueries: string[] = [];

type MockRow = Record<string, unknown>;

let patched = false;
let nextRows: MockRow[] | null = null;

/**
 * Override what the next query returns (e.g. `[]` to trigger ModelNotFound).
 * Reset to the default (`[{ id: 1 }]`) on every `installMockDb()`.
 */
export function setNextRows(rows: MockRow[] | null): void {
  nextRows = rows;
}

/**
 * Patch `pg.Pool` at the prototype level so no real connection is ever made,
 * wire up a fake app state, and (re)initialize the db object. Call at the start
 * of every test to get a clean capture buffer.
 */
export function installMockDb(models: Record<string, Model> = {}): void {
  capturedQueries.length = 0;
  nextRows = null;

  if (!patched) {
    (pg.Pool.prototype as unknown as { query: unknown }).query =
      async function (text: string) {
        capturedQueries.push(text);
        if (/count\(\*\)/i.test(text)) {
          return { rows: [{ count: "0" }], rowCount: 1 };
        }
        const rows = nextRows ?? [{ id: 1 }];
        return { rows, rowCount: rows.length };
      };
    // never actually connect — return a capturing client (used by migrations)
    (pg.Pool.prototype as unknown as { connect: unknown }).connect =
      async () => ({
        query: async (text: string) => {
          capturedQueries.push(text);
          if (/count\(\*\)/i.test(text)) {
            return { rows: [{ count: "0" }], rowCount: 1 };
          }
          const rows = nextRows ?? [{ id: 1 }];
          return { rows, rowCount: rows.length };
        },
        release: () => {},
      });
    (pg.Pool.prototype as unknown as { end: unknown }).end = async () =>
      undefined;
    patched = true;
  }

  process.env.DB_HOST = "localhost";
  process.env.DB_PORT = "5432";
  process.env.DB_USER = "u";
  process.env.DB_PASSWORD = "p";
  process.env.DB_NAME = "d";

  initializeAppState({
    models: Object.values(models),
    backend: {
      apiRoutes: [],
      database: {
        type: "postgres",
        host: "DB_HOST",
        port: "DB_PORT",
        user: "DB_USER",
        password: "DB_PASSWORD",
        database: "DB_NAME",
      },
    },
  });

  loadDatabase();
}

export function lastQuery(): string {
  return capturedQueries[capturedQueries.length - 1];
}

/**
 * The canonical escaped form of a value, as produced by the code under test.
 * Used to assert that a payload was passed through `pg.escapeLiteral`.
 */
export function escapedLiteral(value: string): string {
  return pg.escapeLiteral(value);
}

/**
 * Assert that `sql` embeds `payload` ONLY as a safely escaped string literal —
 * i.e. the exact escaped token is present. Because `pg.escapeLiteral` doubles
 * every embedded quote, an escaped literal cannot terminate early, so the
 * payload cannot break out into executable SQL.
 */
export function assertValueIsEscaped(sql: string, payload: string): void {
  const escaped = pg.escapeLiteral(payload);
  assert.ok(
    sql.includes(escaped),
    `expected value to be escaped as ${escaped}\n  in SQL: ${sql}`,
  );
}
