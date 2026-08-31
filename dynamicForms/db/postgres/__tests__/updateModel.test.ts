import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { updateModel } from "../updateModel";
import {
  installMockDb,
  capturedQueries,
  assertValueIsEscaped,
  escapedLiteral,
} from "../../../test-support/mockDb";
import { customerModel, INJECTION_VALUES } from "../../../test-support/fixtures";

describe("updateModel (db) — UPDATE construction", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("builds a quoted UPDATE with an escaped id predicate", async () => {
    await updateModel(customerModel, 7, { firstName: "Jo" });
    assert.equal(
      capturedQueries[0],
      `UPDATE "customer" SET "firstName" = 'Jo' WHERE "id" = 7`,
    );
  });

  test("REGRESSION: a malicious id cannot widen the WHERE clause", async () => {
    // Previously `WHERE id = 1 OR 1=1` would update every row.
    await updateModel(customerModel, "1 OR 1=1", { firstName: "Jo" });
    assert.equal(
      capturedQueries[0],
      `UPDATE "customer" SET "firstName" = 'Jo' WHERE "id" = '1 OR 1=1'`,
    );
  });

  for (const payload of INJECTION_VALUES) {
    test(`escapes injected id ${JSON.stringify(payload)}`, async () => {
      await updateModel(customerModel, payload, { firstName: "Jo" });
      const sql = capturedQueries[0];
      assert.ok(
        sql.includes(`WHERE "id" = ${escapedLiteral(payload)}`),
        sql,
      );
    });

    test(`escapes injected SET value ${JSON.stringify(payload)}`, async () => {
      await updateModel(customerModel, 1, { firstName: payload });
      assertValueIsEscaped(capturedQueries[0], payload);
    });
  }
});
