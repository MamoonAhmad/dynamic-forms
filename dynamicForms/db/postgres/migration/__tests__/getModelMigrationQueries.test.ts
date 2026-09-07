import { test, describe } from "node:test";
import assert from "node:assert";
import { getModelMigrationQueries } from "../getModelMigrationQueries";
import { Model, ModelField } from "../../../types";

// ---- builders -------------------------------------------------------------

function field(over: Partial<ModelField> = {}): ModelField {
  return { id: "1", name: "col", type: "string", ...over };
}

function model(over: Partial<Model> = {}): Model {
  return { id: 1, name: "Thing", dbTable: "thing", fields: [], ...over };
}

function diff(oldModel: Model | null, newModel: Model) {
  return getModelMigrationQueries(oldModel ? [oldModel] : [], [newModel]);
}

// ---------------------------------------------------------------------------

describe("CREATE TABLE (model is new)", () => {
  test("emits CREATE TABLE up and DROP TABLE down", () => {
    const m = model({
      fields: [
        field({ id: "1", name: "id", type: "number", primaryKey: true }),
        field({ id: "2", name: "firstName", type: "string", required: true }),
        field({ id: "3", name: "address", type: "string" }),
      ],
    });
    const q = getModelMigrationQueries([], [m]);
    assert.deepEqual(q.up, [
      "CREATE TABLE thing (id number PRIMARY KEY, firstName string NOT NULL, address string);",
    ]);
    assert.deepEqual(q.down, ["DROP TABLE thing;"]);
  });

  test("includes DEFAULT in a column definition when set", () => {
    const m = model({
      fields: [field({ id: "1", name: "status", type: "string", required: true, defaultValue: "'new'" })],
    });
    const q = getModelMigrationQueries([], [m]);
    assert.deepEqual(q.up, ["CREATE TABLE thing (status string DEFAULT 'new' NOT NULL);"]);
  });
});

describe("NOT expected / unsupported", () => {
  test("removing a model generates NOTHING (drop-table on delete is unhandled)", () => {
    const a = model({ id: 1, name: "A", dbTable: "a", fields: [field()] });
    const b = model({ id: 2, name: "B", dbTable: "b", fields: [field()] });
    const q = getModelMigrationQueries([a, b], [a]);
    assert.deepEqual(q.up, []);
    assert.deepEqual(q.down, []);
  });

  test("removing a field generates NOTHING (drop-column on delete is unhandled)", () => {
    const old = model({ fields: [field({ id: "1", name: "a" }), field({ id: "2", name: "b" })] });
    const neu = model({ fields: [field({ id: "1", name: "a" })] });
    assert.deepEqual(diff(old, neu), { up: [], down: [] });
  });

  test("no change produces empty up and down", () => {
    const m = model({ fields: [field({ id: "1", name: "a", type: "string" })] });
    assert.deepEqual(diff(structuredClone(m), structuredClone(m)), { up: [], down: [] });
  });

  test("required <-> undefined is not treated as a change", () => {
    const old = model({ fields: [field({ id: "1", name: "a" })] }); // required undefined
    const neu = model({ fields: [field({ id: "1", name: "a", required: false })] });
    assert.deepEqual(diff(old, neu), { up: [], down: [] });
  });
});

describe("ADD COLUMN", () => {
  const base = model({ fields: [field({ id: "1", name: "id", type: "number" })] });

  test("nullable column: ADD COLUMN up, DROP COLUMN down", () => {
    const neu = model({ fields: [...base.fields, field({ id: "2", name: "age", type: "number" })] });
    assert.deepEqual(diff(base, neu), {
      up: ["ALTER TABLE thing ADD COLUMN age number;"],
      down: ["ALTER TABLE thing DROP COLUMN age;"],
    });
  });

  test("primary-key column places PRIMARY KEY", () => {
    const neu = model({ fields: [...base.fields, field({ id: "2", name: "sku", type: "string", primaryKey: true })] });
    assert.deepEqual(diff(base, neu).up, ["ALTER TABLE thing ADD COLUMN sku string PRIMARY KEY;"]);
  });

  test("required column with a default emits DEFAULT and NOT NULL", () => {
    const neu = model({ fields: [...base.fields, field({ id: "2", name: "age", type: "number", required: true, defaultValue: 18 })] });
    assert.deepEqual(diff(base, neu), {
      up: ["ALTER TABLE thing ADD COLUMN age number DEFAULT 18 NOT NULL;"],
      down: ["ALTER TABLE thing DROP COLUMN age;"],
    });
  });

  test("a falsy default (0) is honored, not treated as missing", () => {
    const neu = model({ fields: [...base.fields, field({ id: "2", name: "qty", type: "number", required: true, defaultValue: 0 })] });
    assert.deepEqual(diff(base, neu).up, ["ALTER TABLE thing ADD COLUMN qty number DEFAULT 0 NOT NULL;"]);
  });

  test("required column without a default THROWS", () => {
    const neu = model({ fields: [...base.fields, field({ id: "2", name: "age", type: "number", required: true })] });
    assert.throws(() => diff(base, neu), /Field age is required but has no default value/);
  });

  test("indexed column also creates the index; down drops index then column", () => {
    const neu = model({ fields: [...base.fields, field({ id: "2", name: "email", type: "string", index: true })] });
    assert.deepEqual(diff(base, neu), {
      up: [
        "ALTER TABLE thing ADD COLUMN email string;",
        "CREATE INDEX idx_thing_email ON thing (email);",
      ],
      down: [
        "DROP INDEX idx_thing_email;",
        "ALTER TABLE thing DROP COLUMN email;",
      ],
    });
  });
});

describe("single-attribute changes (up + inverse down)", () => {
  test("RENAME TABLE", () => {
    const old = model({ name: "Old", dbTable: "old_t", fields: [field()] });
    const neu = model({ name: "New", dbTable: "new_t", fields: [field()] });
    assert.deepEqual(diff(old, neu), {
      up: ["ALTER TABLE old_t RENAME TO new_t;"],
      down: ["ALTER TABLE new_t RENAME TO old_t;"],
    });
  });

  test("RENAME COLUMN", () => {
    const old = model({ fields: [field({ id: "1", name: "old_name" })] });
    const neu = model({ fields: [field({ id: "1", name: "new_name" })] });
    assert.deepEqual(diff(old, neu), {
      up: ["ALTER TABLE thing RENAME COLUMN old_name TO new_name;"],
      down: ["ALTER TABLE thing RENAME COLUMN new_name TO old_name;"],
    });
  });

  test("ALTER TYPE", () => {
    const old = model({ fields: [field({ id: "1", name: "col", type: "string" })] });
    const neu = model({ fields: [field({ id: "1", name: "col", type: "number" })] });
    assert.deepEqual(diff(old, neu), {
      up: ["ALTER TABLE thing ALTER COLUMN col TYPE number;"],
      down: ["ALTER TABLE thing ALTER COLUMN col TYPE string;"],
    });
  });

  test("SET NOT NULL", () => {
    const old = model({ fields: [field({ id: "1", name: "col", required: false })] });
    const neu = model({ fields: [field({ id: "1", name: "col", required: true })] });
    assert.deepEqual(diff(old, neu), {
      up: ["ALTER TABLE thing ALTER COLUMN col SET NOT NULL;"],
      down: ["ALTER TABLE thing ALTER COLUMN col DROP NOT NULL;"],
    });
  });

  test("DROP NOT NULL", () => {
    const old = model({ fields: [field({ id: "1", name: "col", required: true })] });
    const neu = model({ fields: [field({ id: "1", name: "col", required: false })] });
    assert.deepEqual(diff(old, neu), {
      up: ["ALTER TABLE thing ALTER COLUMN col DROP NOT NULL;"],
      down: ["ALTER TABLE thing ALTER COLUMN col SET NOT NULL;"],
    });
  });

  test("ADD INDEX", () => {
    const old = model({ fields: [field({ id: "1", name: "col", index: false })] });
    const neu = model({ fields: [field({ id: "1", name: "col", index: true })] });
    assert.deepEqual(diff(old, neu), {
      up: ["CREATE INDEX idx_thing_col ON thing (col);"],
      down: ["DROP INDEX idx_thing_col;"],
    });
  });

  test("DROP INDEX", () => {
    const old = model({ fields: [field({ id: "1", name: "col", index: true })] });
    const neu = model({ fields: [field({ id: "1", name: "col", index: false })] });
    assert.deepEqual(diff(old, neu), {
      up: ["DROP INDEX idx_thing_col;"],
      down: ["CREATE INDEX idx_thing_col ON thing (col);"],
    });
  });

  test("SET DEFAULT", () => {
    const old = model({ fields: [field({ id: "1", name: "col" })] });
    const neu = model({ fields: [field({ id: "1", name: "col", defaultValue: 5 })] });
    assert.deepEqual(diff(old, neu), {
      up: ["ALTER TABLE thing ALTER COLUMN col SET DEFAULT 5;"],
      down: ["ALTER TABLE thing ALTER COLUMN col DROP DEFAULT;"],
    });
  });

  test("DROP DEFAULT restores the OLD default on down (regression)", () => {
    const old = model({ fields: [field({ id: "1", name: "col", defaultValue: 5 })] });
    const neu = model({ fields: [field({ id: "1", name: "col" })] });
    assert.deepEqual(diff(old, neu), {
      up: ["ALTER TABLE thing ALTER COLUMN col DROP DEFAULT;"],
      down: ["ALTER TABLE thing ALTER COLUMN col SET DEFAULT 5;"],
    });
  });

  test("CHANGE DEFAULT restores the OLD value on down", () => {
    const old = model({ fields: [field({ id: "1", name: "col", defaultValue: 1 })] });
    const neu = model({ fields: [field({ id: "1", name: "col", defaultValue: 2 })] });
    assert.deepEqual(diff(old, neu), {
      up: ["ALTER TABLE thing ALTER COLUMN col SET DEFAULT 2;"],
      down: ["ALTER TABLE thing ALTER COLUMN col SET DEFAULT 1;"],
    });
  });

  test("ADD PRIMARY KEY", () => {
    const old = model({ fields: [field({ id: "1", name: "col", primaryKey: false })] });
    const neu = model({ fields: [field({ id: "1", name: "col", primaryKey: true })] });
    assert.deepEqual(diff(old, neu), {
      up: ["ALTER TABLE thing ADD PRIMARY KEY (col);"],
      down: ["ALTER TABLE thing DROP CONSTRAINT thing_pkey;"],
    });
  });

  test("DROP PRIMARY KEY", () => {
    const old = model({ fields: [field({ id: "1", name: "col", primaryKey: true })] });
    const neu = model({ fields: [field({ id: "1", name: "col", primaryKey: false })] });
    assert.deepEqual(diff(old, neu), {
      up: ["ALTER TABLE thing DROP CONSTRAINT thing_pkey;"],
      down: ["ALTER TABLE thing ADD PRIMARY KEY (col);"],
    });
  });
});

describe("data types (emitted verbatim — mapping to real PG types is a separate gap)", () => {
  for (const type of ["number", "string", "date", "boolean"]) {
    test(`type "${type}" is emitted in CREATE TABLE`, () => {
      const m = model({ fields: [field({ id: "1", name: "col", type })] });
      assert.equal(getModelMigrationQueries([], [m]).up[0], `CREATE TABLE thing (col ${type});`);
    });
  }
});

describe("reversibility — down undoes in reverse order with valid identifiers", () => {
  test("rename column + type change: down reverses (type first, then rename back)", () => {
    const old = model({ fields: [field({ id: "1", name: "a", type: "string" })] });
    const neu = model({ fields: [field({ id: "1", name: "b", type: "number" })] });
    assert.deepEqual(diff(old, neu), {
      up: [
        "ALTER TABLE thing RENAME COLUMN a TO b;",
        "ALTER TABLE thing ALTER COLUMN b TYPE number;",
      ],
      down: [
        // undo type on the still-named "b", THEN rename back — every stmt valid
        "ALTER TABLE thing ALTER COLUMN b TYPE string;",
        "ALTER TABLE thing RENAME COLUMN b TO a;",
      ],
    });
  });

  test("rename column + SET NOT NULL: down drops not-null on 'b' then renames back", () => {
    const old = model({ fields: [field({ id: "1", name: "a", required: false })] });
    const neu = model({ fields: [field({ id: "1", name: "b", required: true })] });
    assert.deepEqual(diff(old, neu).down, [
      "ALTER TABLE thing ALTER COLUMN b DROP NOT NULL;",
      "ALTER TABLE thing RENAME COLUMN b TO a;",
    ]);
  });

  test("rename column + add index: down drops index on 'b' then renames back", () => {
    const old = model({ fields: [field({ id: "1", name: "a", index: false })] });
    const neu = model({ fields: [field({ id: "1", name: "b", index: true })] });
    assert.deepEqual(diff(old, neu), {
      up: [
        "ALTER TABLE thing RENAME COLUMN a TO b;",
        "CREATE INDEX idx_thing_b ON thing (b);",
      ],
      down: [
        "DROP INDEX idx_thing_b;",
        "ALTER TABLE thing RENAME COLUMN b TO a;",
      ],
    });
  });

  test("rename TABLE + column type change: down reverts column first, table last", () => {
    const old = model({ name: "Old", dbTable: "old_t", fields: [field({ id: "1", name: "col", type: "string" })] });
    const neu = model({ name: "New", dbTable: "new_t", fields: [field({ id: "1", name: "col", type: "number" })] });
    assert.deepEqual(diff(old, neu), {
      up: [
        "ALTER TABLE old_t RENAME TO new_t;",
        "ALTER TABLE new_t ALTER COLUMN col TYPE number;",
      ],
      down: [
        // still on new_t here...
        "ALTER TABLE new_t ALTER COLUMN col TYPE string;",
        // ...table renamed back last
        "ALTER TABLE new_t RENAME TO old_t;",
      ],
    });
  });

  test("rename + every attribute change at once: down is a fully valid reverse", () => {
    const old = model({
      fields: [field({ id: "1", name: "a", type: "string", required: false, index: false, primaryKey: false })],
    });
    const neu = model({
      fields: [field({ id: "1", name: "b", type: "number", required: true, index: true, defaultValue: 7, primaryKey: true })],
    });
    const q = diff(old, neu);
    assert.deepEqual(q.up, [
      "ALTER TABLE thing RENAME COLUMN a TO b;",
      "ALTER TABLE thing ALTER COLUMN b TYPE number;",
      "ALTER TABLE thing ALTER COLUMN b SET NOT NULL;",
      "CREATE INDEX idx_thing_b ON thing (b);",
      "ALTER TABLE thing ALTER COLUMN b SET DEFAULT 7;",
      "ALTER TABLE thing ADD PRIMARY KEY (b);",
    ]);
    assert.deepEqual(q.down, [
      "ALTER TABLE thing DROP CONSTRAINT thing_pkey;",
      "ALTER TABLE thing ALTER COLUMN b DROP DEFAULT;",
      "DROP INDEX idx_thing_b;",
      "ALTER TABLE thing ALTER COLUMN b DROP NOT NULL;",
      "ALTER TABLE thing ALTER COLUMN b TYPE string;",
      "ALTER TABLE thing RENAME COLUMN b TO a;",
    ]);
  });
});

describe("multiple models in one migration", () => {
  test("collects up in order; down reverses across all models", () => {
    const oldA = model({ id: 1, name: "A", dbTable: "a", fields: [field({ id: "1", name: "id", type: "number" })] });
    const newA = model({ id: 1, name: "A", dbTable: "a", fields: [field({ id: "1", name: "id", type: "number" }), field({ id: "2", name: "x", type: "string" })] });
    const newB = model({ id: 2, name: "B", dbTable: "b", fields: [field({ id: "1", name: "id", type: "number" })] });
    const q = getModelMigrationQueries([oldA], [newA, newB]);
    assert.deepEqual(q.up, [
      "ALTER TABLE a ADD COLUMN x string;",
      "CREATE TABLE b (id number);",
    ]);
    assert.deepEqual(q.down, [
      "DROP TABLE b;",
      "ALTER TABLE a DROP COLUMN x;",
    ]);
  });
});
