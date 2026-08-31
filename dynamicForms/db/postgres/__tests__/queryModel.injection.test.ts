import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { queryModel } from "../queryModel";
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

const OPEN = {} as never; // queryFields config that enables everything by default

describe("queryModel — SQL injection via query-parameter NAMES", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  for (const key of INJECTION_KEYS) {
    test(`rejects malicious key ${JSON.stringify(key)} before building SQL`, async () => {
      await assert.rejects(
        () => queryModel(customerModel, customerListFields, OPEN, { [key]: "x" }),
        /Invalid query parameter/,
      );
      // Nothing must have reached the database.
      assert.equal(
        capturedQueries.length,
        0,
        `no SQL should be executed, got: ${capturedQueries.join(" | ")}`,
      );
    });
  }

  for (const col of UNKNOWN_COLUMNS) {
    test(`rejects unexposed/non-existent column ${JSON.stringify(col)}`, async () => {
      await assert.rejects(
        () => queryModel(customerModel, customerListFields, OPEN, { [col]: "x" }),
        /Invalid query parameter/,
      );
      assert.equal(capturedQueries.length, 0);
    });
  }

  test("rejects a malicious key even in operator form (evil__gte)", async () => {
    await assert.rejects(
      () => queryModel(customerModel, customerListFields, OPEN, { "evil__gte": "1" }),
      /Invalid query parameter/,
    );
    assert.equal(capturedQueries.length, 0);
  });
});

describe("queryModel — SQL injection via VALUES", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  for (const payload of INJECTION_VALUES) {
    test(`escapes equality value ${JSON.stringify(payload)}`, async () => {
      await queryModel(customerModel, customerListFields, OPEN, { firstName: payload });
      const sql = capturedQueries[0];
      assertValueIsEscaped(sql, payload);
      // the column is a quoted identifier, the value a quoted literal
      // (` E'...'` — with a leading space — when the payload needs C-style
      // escaping, e.g. a backslash)
      assert.match(sql, /where "firstName" =\s+E?'/);
    });

    test(`escapes contains value ${JSON.stringify(payload)}`, async () => {
      await queryModel(customerModel, customerListFields, OPEN, {
        firstName__contains: payload,
      });
      const sql = capturedQueries[0];
      assertValueIsEscaped(sql, `%${payload}%`);
      assert.match(sql, /"firstName" ILIKE\s+E?'/);
    });

    test(`escapes numeric-operator value ${JSON.stringify(payload)}`, async () => {
      await queryModel(customerModel, customerListFields, OPEN, { price__gte: payload });
      assertValueIsEscaped(capturedQueries[0], payload);
    });
  }
});

describe("queryModel — identifiers are always quoted", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("table name and list fields are double-quoted", async () => {
    await queryModel(customerModel, customerListFields, OPEN, {});
    const sql = capturedQueries[0];
    assert.match(sql, /from "customer"/);
    assert.match(sql, /select "id", "firstName", "lastName", "email", "price"/);
  });

  test("falls back to (escaped) model.name when dbTable is absent", async () => {
    installMockDb({ Weird: noDbTableModel });
    await queryModel(noDbTableModel, ["id", "value"], OPEN, {});
    // model.name is "weird table" — must be quoted, not left bare
    assert.match(capturedQueries[0], /from "weird table"/);
  });
});
