import { describe, expect, it } from "vitest";

import { customerKey, parseEvent, getProperty } from "./event";
import { getBucketStart, getMatcher, parseReducers, reduce, type Reducer } from "./reducer";

const event = parseEvent({
  name: "api_call",
  external_customer_id: "alice",
  timestamp: "2026-10-12T12:00:00Z",
  metadata: { tokens: 3, nested: { flag: true } },
});
const reducer = (func: "count" | "sum" | "min" | "max"): Reducer => ({
  id: "tokens",
  filter: { conjunction: "and", clauses: [] },
  aggregation: func === "count" ? { func } : { func, property: "tokens" },
});

describe("reduction", () => {
  it.each([
    ["count", 2],
    ["sum", 1],
    ["min", -2],
    ["max", 3],
  ] as const)("reduces %s by customer and bucket", (func, value) => {
    const bucket = getBucketStart(event.timestamp);
    const events = [
      event,
      { ...event, metadata: { tokens: -2 } },
      { ...event, customer: "external:bob" },
      { ...event, timestamp: event.timestamp - 300 },
    ];
    expect(reduce([reducer(func)], events, bucket)).toEqual([
      { customer: "external:alice", reducer: "tokens", bucketStart: bucket, func, value },
      {
        customer: "external:bob",
        reducer: "tokens",
        bucketStart: bucket,
        func,
        value: func === "count" ? 1 : 3,
      },
    ]);
    expect(getBucketStart(-1)).toBe(-300);
    const fractional = parseEvent({
      name: "api",
      external_customer_id: "a",
      timestamp: "1969-12-31T23:59:59.500Z",
    });
    expect(getBucketStart(fractional.timestamp)).toBe(-300);
    expect(getProperty(fractional, "timestamp")).toBe(-0);
  });

  it("matches nested filters without coercing booleans or missing properties", () => {
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
    expect(getProperty(event, "metadata.__proto__.toString")).toBeUndefined();
    expect(getProperty(event, "timestamp")).toBe(event.timestamp);
  });

  it("rejects invalid events/configuration and non-finite reductions", () => {
    expect(() =>
      parseEvent({ name: "api", external_customer_id: "a", timestamp: "2026-10-12T12:00:00" }),
    ).toThrow();
    expect(() => customerKey({ customer_id: "a", external_customer_id: "a" })).toThrow();
    expect(() =>
      parseReducers({ reducers: [{ ...reducer("sum"), aggregation: { func: "median" } }] }),
    ).toThrow();
    expect(reduce([reducer("sum")], [{ ...event, metadata: { tokens: true } }], 0)).toEqual([]);
    expect(() =>
      reduce([reducer("sum")], [{ ...event, metadata: { tokens: Infinity } }], 0),
    ).toThrow();
    expect(() =>
      reduce(
        [reducer("sum")],
        Array(2).fill({ ...event, metadata: { tokens: Number.MAX_VALUE } }),
        0,
      ),
    ).toThrow();
  });
});
