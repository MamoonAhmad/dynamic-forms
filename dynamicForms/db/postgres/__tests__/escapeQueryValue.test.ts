import { test, describe } from "node:test";
import assert from "node:assert";
import pg from "pg";
import { escapeQueryValue, escapeIdentifier } from "../escapeQueryValue";

describe("escapeQueryValue", () => {
  test("escapes strings as SQL string literals", () => {
    assert.equal(escapeQueryValue("hello"), "'hello'");
  });

  test("doubles embedded single quotes (cannot break out)", () => {
    assert.equal(escapeQueryValue("O'Brien"), "'O''Brien'");
    assert.equal(escapeQueryValue("' OR '1'='1"), pg.escapeLiteral("' OR '1'='1"));
  });

  test("returns numbers unquoted", () => {
    assert.equal(escapeQueryValue(42), 42);
    assert.equal(escapeQueryValue(0), 0);
  });

  test("maps booleans to true/false literals", () => {
    assert.equal(escapeQueryValue(true), "true");
    assert.equal(escapeQueryValue(false), "false");
  });

  test("serializes objects to an escaped JSON literal", () => {
    const out = escapeQueryValue({ a: 1 });
    assert.equal(out, pg.escapeLiteral(JSON.stringify({ a: 1 })));
  });

  test("a numeric-looking injection string stays a quoted literal", () => {
    // The classic `1 OR 1=1` must NOT become bare SQL.
    assert.equal(escapeQueryValue("1 OR 1=1"), "'1 OR 1=1'");
  });
});

describe("escapeIdentifier", () => {
  test("wraps identifiers in double quotes", () => {
    assert.equal(escapeIdentifier("firstName"), '"firstName"');
  });

  test("doubles embedded double quotes (cannot break out)", () => {
    assert.equal(escapeIdentifier('foo"bar'), '"foo""bar"');
  });

  test("an injection payload collapses to a single safe identifier", () => {
    const out = escapeIdentifier('id" = 1 OR "1"="1');
    // whole thing is one quoted identifier; internal quotes are doubled
    assert.equal(out, '"id"" = 1 OR ""1""=""1"');
    assert.ok(out.startsWith('"') && out.endsWith('"'));
  });
});
