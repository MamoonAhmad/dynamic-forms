import { test, describe } from "node:test";
import assert from "node:assert";
import { parseListQuery } from "../parseListQuery";
import type { DisabledFilters } from "../../types";

describe("parseListQuery — URL -> structured query", () => {
  test("plain field becomes a scalar equality", () => {
    const { queryFields } = parseListQuery({ firstName: "jo" });
    assert.deepEqual(queryFields, { firstName: "jo" });
  });

  test("operator suffix becomes an operator object", () => {
    const { queryFields } = parseListQuery({ price__gte: "10" });
    assert.deepEqual(queryFields, { price: { gte: "10" } });
  });

  test("multiple operators on one field merge", () => {
    const { queryFields } = parseListQuery({ price__gte: "1", price__lte: "9" });
    assert.deepEqual(queryFields, { price: { gte: "1", lte: "9" } });
  });

  test("value-less operators need no value", () => {
    assert.deepEqual(parseListQuery({ email__is_null: "" }).queryFields, {
      email: { is_null: true },
    });
    assert.deepEqual(parseListQuery({ email__is_not_null: "1" }).queryFields, {
      email: { is_not_null: true },
    });
  });

  test("in accepts a comma-separated string", () => {
    const { queryFields } = parseListQuery({ price__in: "1,2,3" });
    assert.deepEqual(queryFields, { price: { in: ["1", "2", "3"] } });
  });

  test("in accepts a repeated-param array", () => {
    const { queryFields } = parseListQuery({ price__in: ["1", "2"] });
    assert.deepEqual(queryFields, { price: { in: ["1", "2"] } });
  });

  test("empty values are ignored", () => {
    const { queryFields } = parseListQuery({ firstName: "", price__gte: "" });
    assert.deepEqual(queryFields, {});
  });
});

describe("parseListQuery — pagination", () => {
  test("limit/offset are read and NOT treated as filters", () => {
    const parsed = parseListQuery({ limit: "5", offset: "10", firstName: "jo" });
    assert.equal(parsed.limit, 5);
    assert.equal(parsed.offset, 10);
    assert.deepEqual(parsed.queryFields, { firstName: "jo" });
  });

  test("defaults to limit 100 / offset 0", () => {
    const parsed = parseListQuery({});
    assert.equal(parsed.limit, 100);
    assert.equal(parsed.offset, 0);
  });
});

describe("parseListQuery — invalid input", () => {
  test("unknown operator is rejected", () => {
    assert.throws(
      () => parseListQuery({ price__bogus: "1" }),
      /Invalid query parameter/,
    );
  });

  test("too many operator segments are rejected", () => {
    assert.throws(
      () => parseListQuery({ a__b__c: "1" }),
      /Invalid query parameter/,
    );
  });
});

describe("parseListQuery — opt-out disabledFilters", () => {
  test("everything is filterable by default", () => {
    // parser has no model; unknown-but-shaped keys pass here and are the DB
    // layer's job to reject. Point: no config => nothing is blocked.
    const { queryFields } = parseListQuery({ secret: "x" }, {});
    assert.deepEqual(queryFields, { secret: "x" });
  });

  test("a field disabled with false is rejected", () => {
    const disabled: DisabledFilters = { email: false };
    assert.throws(
      () => parseListQuery({ email: "x@y.com" }, disabled),
      /Invalid query parameter/,
    );
  });

  test("disabling a field does not affect siblings", () => {
    const disabled: DisabledFilters = { email: false };
    const { queryFields } = parseListQuery({ firstName: "jo" }, disabled);
    assert.deepEqual(queryFields, { firstName: "jo" });
  });

  test("an operator disabled with false is rejected", () => {
    const disabled: DisabledFilters = { price: { gte: false } };
    assert.throws(
      () => parseListQuery({ price__gte: "10" }, disabled),
      /Invalid query parameter/,
    );
  });

  test("disabling one operator leaves the others enabled", () => {
    const disabled: DisabledFilters = { price: { contains: false } };
    const { queryFields } = parseListQuery({ price__gte: "10" }, disabled);
    assert.deepEqual(queryFields, { price: { gte: "10" } });
  });

  test("disabling eq blocks BOTH ?field=v and ?field__eq=v", () => {
    const disabled: DisabledFilters = { firstName: { eq: false } };
    assert.throws(
      () => parseListQuery({ firstName: "jo" }, disabled),
      /Invalid query parameter/,
    );
    assert.throws(
      () => parseListQuery({ firstName__eq: "jo" }, disabled),
      /Invalid query parameter/,
    );
  });
});
