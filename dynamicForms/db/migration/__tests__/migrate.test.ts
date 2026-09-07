import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate, migrateDown, makeMigration } from "../index";
import { writeAppliedSchema } from "../writeAppliedSchema";
import {
  installMockDb,
  capturedQueries,
  setNextRows,
} from "../../../test-support/mockDb";
import { customerModel } from "../../../test-support/fixtures";
import { initializeAppState } from "../../../appState";
import { Model } from "../../types";

let originalCwd: string;
let tmpDir: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "migtest-"));
  process.chdir(tmpDir);
  installMockDb({ Customer: customerModel });
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeMigration(name: string, up: string, down: string) {
  const dir = path.join("migrations", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "up.sql"), up);
  fs.writeFileSync(path.join(dir, "down.sql"), down);
}

describe("migrate()", () => {
  test("applies all pending migrations in filename order and snapshots the schema", async () => {
    writeMigration("migration_001_a", "CREATE TABLE a (id number);", "DROP TABLE a;");
    writeMigration("migration_002_b", "CREATE TABLE b (id number);", "DROP TABLE b;");
    setNextRows([]); // nothing applied yet

    await migrate();

    const t1 = capturedQueries.findIndex(
      (q) => q.includes("CREATE TABLE a") && q.includes("migration_001_a"),
    );
    const t2 = capturedQueries.findIndex(
      (q) => q.includes("CREATE TABLE b") && q.includes("migration_002_b"),
    );
    assert.ok(t1 >= 0, "first migration ran");
    assert.ok(t2 >= 0, "second migration ran");
    assert.ok(t1 < t2, "ran in sorted order");

    // each is wrapped in a transaction and recorded
    assert.ok(capturedQueries.some((q) => q.includes("BEGIN") && q.includes("COMMIT")));
    assert.ok(capturedQueries.some((q) => q.includes("INSERT INTO migrations")));

    // applied schema snapshot written
    const applied = JSON.parse(fs.readFileSync("appliedSchema.json", "utf-8"));
    assert.equal(applied.models.length, 1);
    assert.equal(applied.models[0].name, "Customer");
  });

  test("skips migrations already recorded as applied", async () => {
    writeMigration("migration_001_a", "CREATE TABLE a (id number);", "DROP TABLE a;");
    writeMigration("migration_002_b", "CREATE TABLE b (id number);", "DROP TABLE b;");
    setNextRows([{ name: "migration_001_a" }]); // first already applied

    await migrate();

    assert.ok(!capturedQueries.some((q) => q.includes("VALUES ('migration_001_a')")));
    assert.ok(capturedQueries.some((q) => q.includes("VALUES ('migration_002_b')")));
  });

  test("throws if a migration is recorded as previously failed", async () => {
    writeMigration("migration_001_a", "CREATE TABLE a (id number);", "DROP TABLE a;");
    setNextRows([{ name: "migration_001_a", failure_reason: "boom" }]);

    await assert.rejects(() => migrate(), /already failed/);
  });

  test("does nothing when there is no migrations folder", async () => {
    setNextRows([]);
    await migrate();
    assert.equal(fs.existsSync("appliedSchema.json"), false);
  });
});

describe("migrateDown()", () => {
  test("throws when no migration matches the name", async () => {
    writeMigration("migration_001_addcol", "up", "down");
    await assert.rejects(() => migrateDown("zzz"), /No migration found/);
  });

  test("throws when more than one migration matches", async () => {
    writeMigration("migration_001_add_a", "u", "d");
    writeMigration("migration_002_add_b", "u", "d");
    await assert.rejects(() => migrateDown("add"), /More than 1/);
  });

  test("runs the down script of the single match inside a transaction and deletes the record", async () => {
    writeMigration(
      "migration_001_addcol",
      "ALTER TABLE thing ADD COLUMN x string;",
      "ALTER TABLE thing DROP COLUMN x;",
    );
    await migrateDown("addcol");
    assert.ok(
      capturedQueries.some(
        (q) =>
          q.includes("DROP COLUMN x") &&
          q.includes("DELETE FROM migrations") &&
          q.includes("migration_001_addcol"),
      ),
    );
  });
});

describe("makeMigration()", () => {
  test("diffs current models against appliedSchema.json and writes up/down files", () => {
    const oldCustomer: Model = {
      id: 1,
      name: "Customer",
      dbTable: "customer",
      fields: [{ id: "1", name: "id", type: "number", primaryKey: true }],
    };
    const newCustomer: Model = {
      ...oldCustomer,
      fields: [...oldCustomer.fields, { id: "2", name: "phone", type: "string" }],
    };

    writeAppliedSchema([oldCustomer]); // the "old" schema
    initializeAppState({
      models: [newCustomer], // the "new" schema
      backend: {
        apiRoutes: [],
        database: { type: "postgres", host: "H", port: "P", user: "U", password: "PW", database: "D" },
      },
    });

    makeMigration("add phone");

    const dir = fs.readdirSync("migrations")[0];
    assert.match(dir, /^migration_\d+_add_phone\.sql$/);
    assert.equal(
      fs.readFileSync(path.join("migrations", dir, "up.sql"), "utf-8"),
      "ALTER TABLE customer ADD COLUMN phone string;",
    );
    assert.equal(
      fs.readFileSync(path.join("migrations", dir, "down.sql"), "utf-8"),
      "ALTER TABLE customer DROP COLUMN phone;",
    );
  });

  test("throws when there is no change to migrate", () => {
    const m: Model = {
      id: 1,
      name: "Customer",
      dbTable: "customer",
      fields: [{ id: "1", name: "id", type: "number", primaryKey: true }],
    };
    writeAppliedSchema([m]);
    initializeAppState({
      models: [m],
      backend: {
        apiRoutes: [],
        database: { type: "postgres", host: "H", port: "P", user: "U", password: "PW", database: "D" },
      },
    });
    assert.throws(() => makeMigration("noop"), /Could not generate queries/);
  });
});
