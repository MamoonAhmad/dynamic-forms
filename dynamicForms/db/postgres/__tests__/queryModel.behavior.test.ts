import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import { queryModel } from "../queryModel";
import type { ModelFieldQuery, QueryModelProps } from "../../types";
import { installMockDb, capturedQueries } from "../../../test-support/mockDb";
import { customerModel, customerListFields } from "../../../test-support/fixtures";

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

describe("queryModel — operators", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  const cases: Array<[string, ModelFieldQuery, string]> = [
    ["scalar eq", { price: "10" }, `"price" = '10'`],
    ["eq", { price: { eq: "10" } }, `"price" = '10'`],
    ["ne", { price: { ne: "10" } }, `"price" != '10'`],
    ["gte", { price: { gte: "10" } }, `"price" >= '10'`],
    ["lte", { price: { lte: "10" } }, `"price" <= '10'`],
    ["lt", { price: { lt: "10" } }, `"price" < '10'`],
    ["gt", { price: { gt: "10" } }, `"price" > '10'`],
    ["contains", { firstName: { contains: "jo" } }, `"firstName" ILIKE '%jo%'`],
    ["is_null", { email: { is_null: true } }, `"email" IS NULL`],
    ["is_not_null", { email: { is_not_null: true } }, `"email" IS NOT NULL`],
    ["in", { price: { in: ["1", "2", "3"] } }, `"price" IN ('1', '2', '3')`],
  ];

  for (const [name, queryFields, fragment] of cases) {
    test(`${name} -> ${fragment}`, async () => {
      await run(queryFields);
      assert.ok(capturedQueries[0].includes(fragment), capturedQueries[0]);
    });
  }

  test("multiple operators on one field are AND-joined in parens", async () => {
    await run({ price: { gte: "1", lte: "9" } });
    assert.match(capturedQueries[0], /\("price" >= '1' AND "price" <= '9'\)/);
  });

  test("multiple fields are AND-joined", async () => {
    await run({ firstName: "jo", price: { gte: "10" } });
    assert.match(capturedQueries[0], /"firstName" = 'jo' AND "price" >= '10'/);
  });

  test("an unknown operator is rejected", async () => {
    await assert.rejects(
      () => run({ price: { bogus: "1" } } as ModelFieldQuery),
      /Invalid operator/,
    );
  });
});

describe("queryModel — AND / OR groups", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("AND group", async () => {
    await run({ AND: [{ firstName: "a" }, { price: { gte: "1" } }] });
    assert.match(capturedQueries[0], /\("firstName" = 'a' AND "price" >= '1'\)/);
  });

  test("OR group", async () => {
    await run({ OR: [{ firstName: "a" }, { firstName: "b" }] });
    assert.match(capturedQueries[0], /\("firstName" = 'a' OR "firstName" = 'b'\)/);
  });

  test("nested AND within OR", async () => {
    await run({
      OR: [{ AND: [{ firstName: "a" }, { lastName: "b" }] }, { email: "c" }],
    });
    assert.match(
      capturedQueries[0],
      /\(\("firstName" = 'a' AND "lastName" = 'b'\) OR "email" = 'c'\)/,
    );
  });
});

describe("queryModel — pagination", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("limit and offset are applied", async () => {
    await run({}, { limit: 5, offset: 10 });
    assert.match(capturedQueries[0], /LIMIT 5 OFFSET 10/);
  });

  test("offset 0 emits no OFFSET clause", async () => {
    await run({}, { limit: 25, offset: 0 });
    assert.match(capturedQueries[0], /LIMIT 25/);
    assert.doesNotMatch(capturedQueries[0], /OFFSET/);
  });
});

describe("queryModel — list fields", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("empty listFields selects *", async () => {
    await run({}, { listFields: [] });
    assert.match(capturedQueries[0], /SELECT \* FROM "customer"/);
  });

  test("a non-column list field is rejected", async () => {
    await assert.rejects(
      () => run({}, { listFields: ["id", "bogus"] }),
      /Invalid model field name/,
    );
  });
});

describe("queryModel — result shape", () => {
  beforeEach(() => installMockDb({ Customer: customerModel }));

  test("countTotal runs a second COUNT query and returns a numeric total", async () => {
    const out = (await run({}, { countTotal: true })) as {
      data: unknown[];
      total: number;
      resultCount: number | null;
    };
    assert.equal(capturedQueries.length, 2);
    assert.match(capturedQueries[1], /COUNT\(\*\)/);
    assert.strictEqual(out.total, 0); // number, not the string "0"
    assert.ok("data" in out && "resultCount" in out);
  });

  test("without countTotal there is no second query and no total", async () => {
    const out = (await run({})) as { total?: number };
    assert.equal(capturedQueries.length, 1);
    assert.equal(out.total, undefined);
  });
});
