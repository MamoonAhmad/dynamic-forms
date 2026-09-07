import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readOldModels } from "../readOldModels";
import { writeAppliedSchema } from "../writeAppliedSchema";
import { createMigrationFile } from "../createMigrationFile";
import { initializeAppState } from "../../../appState";
import { Model } from "../../types";

// All of these resolve paths from process.cwd(); run each test in an isolated
// temp directory so nothing touches the repo.
let originalCwd: string;
let tmpDir: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "migtest-"));
  process.chdir(tmpDir);
  // getMigrationFileExtension() reads the db type off app state.
  initializeAppState({
    models: [],
    backend: {
      apiRoutes: [],
      database: {
        type: "postgres",
        host: "H",
        port: "P",
        user: "U",
        password: "PW",
        database: "D",
      },
    },
  });
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const models: Model[] = [
  {
    id: 1,
    name: "Customer",
    dbTable: "customer",
    fields: [{ id: "1", name: "id", type: "number", primaryKey: true }],
  },
];

describe("readOldModels / writeAppliedSchema", () => {
  test("returns [] when appliedSchema.json does not exist", () => {
    assert.deepEqual(readOldModels(), []);
  });

  test("round-trips the models array", () => {
    writeAppliedSchema(models);
    assert.deepEqual(readOldModels(), models);
  });

  test("appliedSchema.json contains ONLY a models array (no backend)", () => {
    writeAppliedSchema(models);
    const parsed = JSON.parse(fs.readFileSync("appliedSchema.json", "utf-8"));
    assert.deepEqual(Object.keys(parsed), ["models"]);
    assert.ok(Array.isArray(parsed.models));
  });
});

describe("createMigrationFile", () => {
  test("creates migrations/<name>/ with up.sql and down.sql", () => {
    createMigrationFile("add_phone", {
      up: ["ALTER TABLE customer ADD COLUMN phone string;"],
      down: ["ALTER TABLE customer DROP COLUMN phone;"],
    });

    const dirs = fs.readdirSync("migrations");
    assert.equal(dirs.length, 1);
    assert.match(dirs[0], /^migration_\d+_add_phone\.sql$/);

    const base = path.join("migrations", dirs[0]);
    assert.equal(
      fs.readFileSync(path.join(base, "up.sql"), "utf-8"),
      "ALTER TABLE customer ADD COLUMN phone string;",
    );
    assert.equal(
      fs.readFileSync(path.join(base, "down.sql"), "utf-8"),
      "ALTER TABLE customer DROP COLUMN phone;",
    );
  });

  test("joins multiple statements with newlines", () => {
    createMigrationFile("multi", {
      up: ["CREATE TABLE a (id number);", "CREATE INDEX idx_a_id ON a (id);"],
      down: ["DROP TABLE a;"],
    });
    const dir = fs.readdirSync("migrations")[0];
    const up = fs.readFileSync(path.join("migrations", dir, "up.sql"), "utf-8");
    assert.equal(up, "CREATE TABLE a (id number);\nCREATE INDEX idx_a_id ON a (id);");
  });

  test("works when the migrations/ folder does not exist yet (recursive mkdir)", () => {
    assert.equal(fs.existsSync("migrations"), false);
    createMigrationFile("first", { up: ["CREATE TABLE a (id number);"], down: ["DROP TABLE a;"] });
    assert.equal(fs.existsSync("migrations"), true);
  });
});
