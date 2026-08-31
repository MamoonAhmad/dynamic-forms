import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { saveModel } from "../saveModel";
import {
  installMockDb,
  capturedQueries,
  assertValueIsEscaped,
} from "../../../test-support/mockDb";
import { customerModel, INJECTION_VALUES } from "../../../test-support/fixtures";

describe("saveModel (db) — INSERT construction", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("builds a parameter-quoted INSERT with RETURNING", async () => {
    await saveModel(customerModel, { firstName: "Jo", email: "a@b.com" });
    const sql = capturedQueries[0];
    assert.match(sql, /INSERT INTO "customer" \("firstName", "email"\)/);
    assert.match(sql, /VALUES \('Jo', 'a@b.com'\)/);
    // RETURNING lists every model field, quoted
    assert.match(sql, /RETURNING "id", "firstName", "lastName", "email", "price", "secret"/);
  });

  test("returns the inserted row", async () => {
    const row = await saveModel(customerModel, { firstName: "Jo" });
    assert.deepEqual(row, { id: 1 });
  });

  for (const payload of INJECTION_VALUES) {
    test(`escapes injected value ${JSON.stringify(payload)}`, async () => {
      await saveModel(customerModel, { firstName: payload });
      assertValueIsEscaped(capturedQueries[0], payload);
    });
  }

  test("escapes a malicious column name as a single identifier", async () => {
    await saveModel(customerModel, { 'x"; DROP TABLE customer;--': "v" } as never);
    // the key becomes one quoted identifier with doubled quotes, never raw SQL
    assert.match(capturedQueries[0], /"x""; DROP TABLE customer;--"/);
  });
});
