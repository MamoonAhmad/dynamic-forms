import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { queryModel } from "../queryModel";
import { installMockDb, capturedQueries } from "../../../test-support/mockDb";
import { customerModel, customerListFields } from "../../../test-support/fixtures";

const OPEN = {} as never;

describe("queryModel — operators", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  const cases: Array<[string, string, string]> = [
    ["price__eq", '"price" =', "10"],
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

describe("queryModel — opt-out disabledFilters config", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("every model field is queryable by default (empty config)", async () => {
    // `secret` is a real column not mentioned anywhere in the config.
    await queryModel(customerModel, customerListFields, {} as never, { secret: "x" });
    assert.match(capturedQueries[0], /where "secret" = 'x'/);
  });

  test("a field explicitly disabled with `false` is rejected", async () => {
    const qf = { email: false } as never;
    await assert.rejects(
      () => queryModel(customerModel, customerListFields, qf, { email: "x@y.com" }),
      /Invalid query parameter/,
    );
    assert.equal(capturedQueries.length, 0);
  });

  test("disabling a field does not affect sibling fields", async () => {
    const qf = { email: false } as never;
    await queryModel(customerModel, customerListFields, qf, { firstName: "jo" });
    assert.match(capturedQueries[0], /where "firstName" = 'jo'/);
  });

  test("an operator explicitly disabled with `false` is rejected", async () => {
    const qf = { price: { gte: false } } as never;
    await assert.rejects(
      () => queryModel(customerModel, customerListFields, qf, { price__gte: "10" }),
      /Invalid query parameter/,
    );
  });

  test("disabling one operator leaves the others enabled", async () => {
    const qf = { price: { contains: false } } as never;
    await queryModel(customerModel, customerListFields, qf, { price__gte: "10" });
    assert.match(capturedQueries[0], /"price" >= '10'/);
  });

  test("disabling `eq` blocks BOTH ?field=v and ?field__eq=v", async () => {
    const qf = { firstName: { eq: false } } as never;
    await assert.rejects(
      () => queryModel(customerModel, customerListFields, qf, { firstName: "jo" }),
      /Invalid query parameter/,
    );
    installMockDb({ Customer: customerModel });
    await assert.rejects(
      () => queryModel(customerModel, customerListFields, qf, { firstName__eq: "jo" }),
      /Invalid query parameter/,
    );
  });

  test("an empty value produces no predicate", async () => {
    await queryModel(customerModel, customerListFields, {} as never, { firstName: "" });
    assert.doesNotMatch(capturedQueries[0], /where/);
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
