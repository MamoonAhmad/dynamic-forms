import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { queryModel } from "../queryModel";
import type { ModelFieldQuery, QueryModelProps } from "../../types";
import {
  installMockDb,
  capturedQueries,
  assertValueIsEscaped,
} from "../../../test-support/mockDb";
import {
  customerModel,
  customerListFields,
  noDbTableModel,
  INJECTION_VALUES,
  INJECTION_KEYS,
  UNKNOWN_COLUMNS,
} from "../../../test-support/fixtures";

function run(
  queryFields: ModelFieldQuery,
  extra: Partial<QueryModelProps> = {},
): Promise<unknown> {
  return queryModel({
    model: customerModel,
    listFields: customerListFields,
    queryFields,
    limit: 100,
    offset: 0,
    ...extra,
  });
}

describe("queryModel — SQL injection via field NAMES", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  for (const key of [...INJECTION_KEYS, ...UNKNOWN_COLUMNS]) {
    test(`rejects non-column field ${JSON.stringify(key)} before building SQL`, async () => {
      await assert.rejects(
        () => run({ [key]: "x" }),
        /Invalid model field name/,
      );
      // Nothing must have reached the database.
      assert.equal(
        capturedQueries.length,
        0,
        `no SQL should be executed, got: ${capturedQueries.join(" | ")}`,
      );
    });
  }

  test("rejects a bad field name inside an operator object", async () => {
    await assert.rejects(
      () => run({ 'bad"col': { gte: "1" } }),
      /Invalid model field name/,
    );
    assert.equal(capturedQueries.length, 0);
  });

  test("rejects a bad field name nested inside AND/OR", async () => {
    await assert.rejects(
      () => run({ AND: [{ 'bad"col': "1" }] }),
      /Invalid model field name/,
    );
    assert.equal(capturedQueries.length, 0);
  });

  test("rejects a bad column in listFields before building SQL", async () => {
    await assert.rejects(
      () => run({}, { listFields: ["id", 'evil"; DROP TABLE customer;--'] }),
      /Invalid model field name/,
    );
    assert.equal(capturedQueries.length, 0);
  });
});

describe("queryModel — SQL injection via VALUES", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  for (const payload of INJECTION_VALUES) {
    test(`escapes equality value ${JSON.stringify(payload)}`, async () => {
      await run({ firstName: payload });
      const sql = capturedQueries[0];
      assertValueIsEscaped(sql, payload);
      // the column is a quoted identifier, the value a quoted literal
      // (` E'...'` — with a leading space — when the payload needs C-style
      // escaping, e.g. a backslash)
      assert.match(sql, /WHERE "firstName" =\s+E?'/);
    });

    test(`escapes contains value ${JSON.stringify(payload)}`, async () => {
      await run({ firstName: { contains: payload } });
      const sql = capturedQueries[0];
      assertValueIsEscaped(sql, `%${payload}%`);
      assert.match(sql, /"firstName" ILIKE\s+E?'/);
    });

    test(`escapes numeric-operator value ${JSON.stringify(payload)}`, async () => {
      await run({ price: { gte: payload } });
      assertValueIsEscaped(capturedQueries[0], payload);
    });

    test(`escapes IN-list value ${JSON.stringify(payload)}`, async () => {
      await run({ price: { in: [payload] } });
      assertValueIsEscaped(capturedQueries[0], payload);
    });
  }
});

describe("queryModel — identifiers are always quoted", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("table name and list fields are double-quoted", async () => {
    await run({});
    const sql = capturedQueries[0];
    assert.match(sql, /FROM "customer"/);
    assert.match(sql, /SELECT "id", "firstName", "lastName", "email", "price"/);
  });

  test("falls back to (escaped) model.name when dbTable is absent", async () => {
    installMockDb({ Weird: noDbTableModel });
    await queryModel({
      model: noDbTableModel,
      listFields: ["id", "value"],
      queryFields: {},
      limit: 100,
      offset: 0,
    });
    // model.name is "weird table" — must be quoted, not left bare
    assert.match(capturedQueries[0], /FROM "weird table"/);
  });
});
