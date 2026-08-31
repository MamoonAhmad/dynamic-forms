import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { queryModel } from "../queryModel";
import { installMockDb, capturedQueries } from "../../../test-support/mockDb";
import { customerModel, customerListFields } from "../../../test-support/fixtures";

const OPEN = {} as never;

describe("queryModel — operators", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  const cases: Array<[string, string, string]> = [
    ["price__gte", '"price" >=', "10"],
    ["price__lte", '"price" <=', "10"],
    ["price__lt", '"price" <', "10"],
    ["price__gt", '"price" >', "10"],
  ];

  for (const [key, fragment, value] of cases) {
    test(`${key} -> ${fragment}`, async () => {
      await queryModel(customerModel, customerListFields, OPEN, { [key]: value });
      assert.ok(capturedQueries[0].includes(fragment), capturedQueries[0]);
    });
  }

  test("is_null / is_not_null render without a bound value", async () => {
    await queryModel(customerModel, customerListFields, OPEN, { email__is_null: "1" });
    assert.match(capturedQueries[0], /"email" IS NULL/);

    installMockDb({ Customer: customerModel });
    await queryModel(customerModel, customerListFields, OPEN, { email__is_not_null: "1" });
    assert.match(capturedQueries[0], /"email" IS NOT NULL/);
  });

  test("contains uses ILIKE with wildcards", async () => {
    await queryModel(customerModel, customerListFields, OPEN, { firstName__contains: "jo" });
    assert.match(capturedQueries[0], /"firstName" ILIKE '%jo%'/);
  });

  test("an unknown operator on a valid field is rejected", async () => {
    await assert.rejects(
      () => queryModel(customerModel, customerListFields, OPEN, { price__bogus: "1" }),
      /Invalid operator/,
    );
  });

  test("multiple filters are AND-joined", async () => {
    await queryModel(customerModel, customerListFields, OPEN, {
      firstName: "jo",
      price__gte: "10",
    });
    assert.match(capturedQueries[0], /where .* AND /);
  });
});

describe("queryModel — pagination", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("page/perPage control LIMIT/OFFSET and are NOT treated as filters", async () => {
    await queryModel(customerModel, customerListFields, OPEN, { page: "3", perPage: "5" });
    const sql = capturedQueries[0];
    assert.match(sql, /limit 5 offset 10/);
    // regression: these must never become WHERE predicates on phantom columns
    assert.doesNotMatch(sql, /"page"/);
    assert.doesNotMatch(sql, /"perPage"/);
    assert.doesNotMatch(sql, /where/);
  });

  test("defaults to page 1 / perPage 10", async () => {
    await queryModel(customerModel, customerListFields, OPEN, {});
    assert.match(capturedQueries[0], /limit 10 offset 0/);
  });
});

describe("queryModel — queryFields config gating", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("a field explicitly disabled with `false` is rejected", async () => {
    const qf = { email: false } as never;
    await assert.rejects(
      () => queryModel(customerModel, customerListFields, qf, { email: "x@y.com" }),
      /Invalid query parameter/,
    );
  });

  test("an operator explicitly disabled with `false` is rejected", async () => {
    const qf = { price: { gte: false } } as never;
    await assert.rejects(
      () => queryModel(customerModel, customerListFields, qf, { price__gte: "10" }),
      /Invalid query parameter/,
    );
  });
});

describe("queryModel — result shape", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("returns data, total and resultCount", async () => {
    const out = await queryModel(customerModel, customerListFields, OPEN, {});
    assert.deepEqual(Object.keys(out).sort(), ["data", "resultCount", "total"]);
    // two queries: the data select and the count
    assert.equal(capturedQueries.length, 2);
    assert.match(capturedQueries[1], /count\(\*\)/);
  });
});
