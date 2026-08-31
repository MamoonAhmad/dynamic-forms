import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import type { Request, Response } from "express";
import { saveModel } from "../saveModel";
import { updateModel } from "../updateModel";
import { getModel } from "../getModel";
import { listModel } from "../listModel";
import { deleteModel } from "../deleteModel";
import {
  installMockDb,
  capturedQueries,
  setNextRows,
} from "../../test-support/mockDb";
import { customerModel, customerListFields } from "../../test-support/fixtures";

interface MockRes {
  statusCode: number;
  body: unknown;
  status(code: number): MockRes;
  json(body: unknown): MockRes;
}

function mockRes(): MockRes {
  const res = { statusCode: 200, body: undefined as unknown } as MockRes;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res;
}

function req(parts: Partial<{ body: unknown; params: unknown; query: unknown }>): Request {
  return { body: {}, params: {}, query: {}, ...parts } as unknown as Request;
}

const models = { Customer: customerModel };
const validBody = { firstName: "Jo", lastName: "Do", email: "a@b.com" };

describe("CREATE handler (saveModel)", () => {
  beforeEach(() => installMockDb(models));

  test("valid body inserts and returns the row", async () => {
    const res = mockRes();
    const handler = await saveModel("Customer");
    await handler(req({ body: validBody }), res as unknown as Response);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { id: 1 });
  });

  test("missing required fields -> 400 with errors", async () => {
    const res = mockRes();
    const handler = await saveModel("Customer");
    await handler(req({ body: { firstName: "Jo" } }), res as unknown as Response);
    assert.equal(res.statusCode, 400);
    const body = res.body as { success: boolean; errors: Record<string, string> };
    assert.equal(body.success, false);
    assert.ok(body.errors.lastName);
    assert.ok(body.errors.email);
    assert.equal(capturedQueries.length, 0);
  });
});

describe("GET handler (getModel)", () => {
  beforeEach(() => installMockDb(models));

  test("found -> row", async () => {
    setNextRows([{ id: 9, firstName: "Jo" }]);
    const res = mockRes();
    const handler = await getModel("Customer", customerListFields);
    await handler(req({ params: { id: "9" } }), res as unknown as Response);
    assert.deepEqual(res.body, { id: 9, firstName: "Jo" });
  });

  test("not found -> 404", async () => {
    setNextRows([]);
    const res = mockRes();
    const handler = await getModel("Customer", customerListFields);
    await handler(req({ params: { id: "999" } }), res as unknown as Response);
    assert.equal(res.statusCode, 404);
  });
});

describe("UPDATE handler (updateModel)", () => {
  beforeEach(() => installMockDb(models));

  test("valid update returns the refreshed row", async () => {
    const res = mockRes();
    const handler = await updateModel("Customer", customerListFields);
    await handler(
      req({ params: { id: "1" }, body: validBody }),
      res as unknown as Response,
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { id: 1 });
  });

  test("nonexistent record -> 404", async () => {
    setNextRows([]); // existence check finds nothing
    const res = mockRes();
    const handler = await updateModel("Customer", customerListFields);
    await handler(
      req({ params: { id: "999" }, body: validBody }),
      res as unknown as Response,
    );
    assert.equal(res.statusCode, 404);
  });

  test("validation error -> 400", async () => {
    const res = mockRes();
    const handler = await updateModel("Customer", customerListFields);
    await handler(
      req({ params: { id: "1" }, body: { firstName: "Jo" } }),
      res as unknown as Response,
    );
    assert.equal(res.statusCode, 400);
  });
});

describe("DELETE handler (deleteModel)", () => {
  beforeEach(() => installMockDb(models));

  test("returns success", async () => {
    const res = mockRes();
    const handler = await deleteModel("Customer");
    await handler(req({ params: { id: "1" } }), res as unknown as Response);
    assert.deepEqual(res.body, { success: true });
  });
});

describe("LIST handler (listModel)", () => {
  beforeEach(() => installMockDb(models));

  test("returns the list payload", async () => {
    const res = mockRes();
    const handler = await listModel("Customer", customerListFields, {});
    await handler(req({ query: { firstName: "Jo" } }), res as unknown as Response);
    const body = res.body as { data: unknown[] };
    assert.ok(Array.isArray(body.data));
  });

  test("END-TO-END: an injection attempt via query key never reaches the DB", async () => {
    const res = mockRes();
    const handler = await listModel("Customer", customerListFields, {});
    await handler(
      req({ query: { 'id" = 1 OR "1"="1': "x" } }),
      res as unknown as Response,
    );
    // handler rejects the request; crucially, NO SQL was executed
    assert.equal(res.statusCode, 500);
    assert.equal(
      capturedQueries.length,
      0,
      `no SQL should run, got: ${capturedQueries.join(" | ")}`,
    );
  });
});
