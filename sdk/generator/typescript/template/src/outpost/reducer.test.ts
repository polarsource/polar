import { describe, expect, it } from "vitest";

import { customerKey, parseEvent, getPropertyReader } from "./event";
import {
  BUCKET_SIZE,
  getBucketStart,
  getMatcher,
  matchEvent,
  withMatchers,
  type Reducer,
  quantity,
  emptyStatistics,
  addStatistics,
} from "./reducer";

const event = {
  ...parseEvent({
    name: "api_call",
    external_customer_id: "alice",
    timestamp: "2026-10-12T12:00:00Z",
  }),
  metadata: { tokens: 3, nested: { flag: true } },
};
const reducer = (func: "count" | "sum" | "min" | "max" | "avg"): Reducer => ({
  id: "tokens",
  kind: "usage",
  filter: { conjunction: "and", clauses: [] },
  aggregation: func === "count" ? { func } : { func, property: "tokens" },
});

describe("reduction", () => {
  it("keeps microseconds at event parsing and bucket boundaries", () => {
    const precise = parseEvent({
      name: "api",
      external_customer_id: "a",
      timestamp: "2026-10-12T12:00:00.123456Z",
    });
    expect(precise.timestamp).toBe(1791806400123456);
    expect(getPropertyReader("timestamp")(precise)).toBe(1791806400);
    expect(getBucketStart(BUCKET_SIZE - 1)).toBe(0);
    expect(getBucketStart(BUCKET_SIZE)).toBe(BUCKET_SIZE);
    expect(getBucketStart(-1)).toBe(-BUCKET_SIZE);
  });
  it.each(["count", "sum", "min", "max", "avg"] as const)("reads empty %s as zero", (func) => {
    expect(quantity(emptyStatistics(), func)).toBe(0);
  });
  it.each([
    ["count", 2],
    ["sum", 1],
    ["min", -2],
    ["max", 3],
    ["avg", 0.5],
  ] as const)("matches an event with the value its %s reducer adds up", (func, value) => {
    const matchers = withMatchers([reducer(func)]);
    const statistics = emptyStatistics();
    for (const tokens of [3, -2]) {
      const matches = matchEvent(matchers, { ...event, metadata: { tokens } });
      expect(matches).toEqual([{ reducer: "tokens", value: func === "count" ? null : tokens }]);
      addStatistics(
        statistics,
        func === "count"
          ? { count: 1, sum: 0, min: null, max: null }
          : { count: 1, sum: tokens, min: tokens, max: tokens },
      );
    }
    expect(quantity(statistics, func)).toBe(value);
    expect(getBucketStart(-1)).toBe(-BUCKET_SIZE);
    const fractional = parseEvent({
      name: "api",
      external_customer_id: "a",
      timestamp: "1969-12-31T23:59:59.500Z",
    });
    expect(getBucketStart(fractional.timestamp)).toBe(-BUCKET_SIZE);
    expect(getPropertyReader("timestamp")(fractional)).toBe(-0);
  });

  it("matches nested filters and ignores missing properties", () => {
    const match = getMatcher({
      conjunction: "and",
      clauses: [
        { property: "source", operator: "eq", value: "user" },
        {
          conjunction: "or",
          clauses: [
            { property: "name", operator: "eq", value: "other" },
            { property: "metadata.tokens", operator: "gte", value: 3 },
          ],
        },
        { property: "nested.flag", operator: "eq", value: true },
      ],
    });
    expect(match(event)).toBe(true);
    expect(getMatcher({ property: "missing", operator: "ne", value: 1 })(event)).toBe(false);
    expect(getMatcher({ property: "nested.flag", operator: "eq", value: 1 })(event)).toBe(false);
    expect(getMatcher({ property: "nested.flag", operator: "gt", value: false })(event)).toBe(
      false,
    );
    expect(getPropertyReader("metadata.__proto__.toString")(event)).toBeUndefined();
    expect(getPropertyReader("timestamp")(event)).toBe(event.timestamp / 1_000_000);
  });

  it.each(["and", "or"] as const)(
    "matches every event with an empty %s, like Polar",
    (conjunction) => {
      expect(getMatcher({ conjunction, clauses: [] })(event)).toBe(true);
    },
  );

  it.each([
    [true, true, true],
    [true, 1, false],
    [1, true, false],
    [false, 0, false],
    [0, false, false],
    [true, 2, false],
    [false, 1, false],
    ["1", 1, false],
    ["0", false, false],
  ] as const)("compares %s and %s like Polar", (actual, expected, equal) => {
    const sample = { ...event, metadata: { value: actual } };
    expect(getMatcher({ property: "value", operator: "eq", value: expected })(sample)).toBe(equal);
    expect(getMatcher({ property: "value", operator: "ne", value: expected })(sample)).toBe(!equal);
  });

  it.each([
    ["gpt-4o-mini", "4o", true],
    ["gpt-4o-mini", "claude", false],
    ["gpt-4o-mini", "GPT", false],
    ["100%_done", "%_", true],
  ] as const)("checks whether %s contains %s like Polar", (actual, expected, contained) => {
    const sample = { ...event, metadata: { value: actual } };
    expect(getMatcher({ property: "value", operator: "like", value: expected })(sample)).toBe(
      contained,
    );
    expect(getMatcher({ property: "value", operator: "not_like", value: expected })(sample)).toBe(
      !contained,
    );
  });

  it.each([
    [1234, "23"],
    [true, "true"],
    ["1234", 23],
    ["true", true],
  ] as const)(
    "matches neither like nor not_like when %s or %s is not a string",
    (actual, expected) => {
      const sample = { ...event, metadata: { value: actual } };
      for (const operator of ["like", "not_like"] as const)
        expect(getMatcher({ property: "value", operator, value: expected })(sample)).toBe(false);
    },
  );

  it.each(["like", "not_like"] as const)("ignores missing properties for %s", (operator) => {
    expect(getMatcher({ property: "missing", operator, value: "a" })(event)).toBe(false);
  });

  it("rejects ambiguous customers, timezone-free timestamps, and non-finite reductions", () => {
    expect(() =>
      parseEvent({ name: "api", external_customer_id: "a", timestamp: "2026-10-12T12:00:00" }),
    ).toThrow();
    expect(() => customerKey({ customer_id: "a", external_customer_id: "a" })).toThrow();
    expect(
      matchEvent(withMatchers([reducer("sum")]), { ...event, metadata: { tokens: true } }),
    ).toEqual([]);
    expect(() =>
      matchEvent(withMatchers([reducer("sum")]), { ...event, metadata: { tokens: Infinity } }),
    ).toThrow();
    const huge = { count: 1, sum: Number.MAX_VALUE, min: Number.MAX_VALUE, max: Number.MAX_VALUE };
    expect(() => addStatistics({ ...huge }, huge)).toThrow();
  });

  it("matches no local event against a credit reducer", () => {
    expect(matchEvent(withMatchers([{ ...reducer("sum"), kind: "credit" }]), event)).toEqual([]);
  });
});
