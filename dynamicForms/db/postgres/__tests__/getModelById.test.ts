import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { getModelById } from "../getModelById";
import { ModelNotFoundError } from "../../../models/ModelNotFound";
import {
  installMockDb,
  capturedQueries,
  setNextRows,
  escapedLiteral,
} from "../../../test-support/mockDb";
import { customerModel, INJECTION_VALUES } from "../../../test-support/fixtures";

describe("getModelById (db)", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("builds a quoted SELECT with an escaped id", async () => {
    await getModelById(customerModel, "42", ["id", "firstName"]);
    assert.equal(
      capturedQueries[0],
      `SELECT "id", "firstName" FROM "customer" WHERE "id" = '42'`,
    );
  });

  for (const payload of INJECTION_VALUES) {
    test(`escapes injected id ${JSON.stringify(payload)}`, async () => {
      await getModelById(customerModel, payload, ["id"]);
      assert.ok(
        capturedQueries[0].includes(`WHERE "id" = ${escapedLiteral(payload)}`),
        capturedQueries[0],
      );
    });
  }

  test("throws ModelNotFoundError when no row matches", async () => {
    setNextRows([]);
    await assert.rejects(
      () => getModelById(customerModel, "999", ["id"]),
      ModelNotFoundError,
    );
  });

  test("returns the row when found", async () => {
    setNextRows([{ id: 5, firstName: "Jo" }]);
    const row = await getModelById(customerModel, "5", ["id", "firstName"]);
    assert.deepEqual(row, { id: 5, firstName: "Jo" });
  });
});
