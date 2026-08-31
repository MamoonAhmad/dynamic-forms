import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { deleteModel } from "../deleteModel";
import {
  installMockDb,
  capturedQueries,
  escapedLiteral,
} from "../../../test-support/mockDb";
import { customerModel, INJECTION_VALUES } from "../../../test-support/fixtures";

describe("deleteModel (db)", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("builds a quoted DELETE with an escaped id", async () => {
    await deleteModel(customerModel, "42");
    assert.equal(
      capturedQueries[0],
      `DELETE FROM "customer" WHERE "id" = '42'`,
    );
  });

  test("REGRESSION: a malicious id cannot widen the WHERE clause", async () => {
    await deleteModel(customerModel, "1 OR 1=1");
    assert.equal(
      capturedQueries[0],
      `DELETE FROM "customer" WHERE "id" = '1 OR 1=1'`,
    );
  });

  for (const payload of INJECTION_VALUES) {
    test(`escapes injected id ${JSON.stringify(payload)}`, async () => {
      await deleteModel(customerModel, payload);
      assert.ok(
        capturedQueries[0].includes(`WHERE "id" = ${escapedLiteral(payload)}`),
        capturedQueries[0],
      );
    });
  }

  test("returns success:false with id required when id is empty", async () => {
    const out = await deleteModel(customerModel, "");
    assert.deepEqual(out, { success: false, errors: { id: "ID is required." } });
    assert.equal(capturedQueries.length, 0);
  });

  test("returns success:true on delete", async () => {
    const out = await deleteModel(customerModel, "5");
    assert.deepEqual(out, { success: true });
  });
});
