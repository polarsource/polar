import { bench, describe } from "vitest";

import type { Event } from "./event";

import benchmark from "./benchmark.json";
import {
  type Aggregation,
  type Filter,
  type FilterClause,
  type Reducer,
  getBucketStart,
  getMatcher,
  reduce,
  withMatchers,
} from "./reducer";

const { seed, count, customers: CUSTOMERS, names: NAMES, models: MODELS } = benchmark.events;
// Events start at the cold boundary, one per second.
const START = benchmark.cold_until;

// Mulberry32: the same events on every run, so the numbers compare across commits.
const seeded = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const makeEvents = (count: number): Event[] => {
  const random = seeded(seed);
  return Array.from({ length: count }, (_, index) => ({
    name: NAMES[Math.floor(random() * NAMES.length)],
    customer: `external:kr-${String(1 + Math.floor(random() * CUSTOMERS)).padStart(3, "0")}`,
    timestamp: START + index * 1_000_000,
    metadata: {
      tokens: Math.floor(random() * 12_000),
      model: MODELS[Math.floor(random() * MODELS.length)],
      _llm: { input_tokens: Math.floor(random() * 8_000), vendor: "anthropic" },
    },
  }));
};

const events = makeEvents(count);
const oldestBucketStart = getBucketStart(START);

const clause = (
  property: string,
  operator: FilterClause["operator"],
  value: FilterClause["value"],
): FilterClause => ({ property, operator, value });
const all = (...clauses: (Filter | FilterClause)[]): Filter => ({ conjunction: "and", clauses });
const any = (...clauses: (Filter | FilterClause)[]): Filter => ({ conjunction: "or", clauses });

const reducerOf = (id: string, filter: Filter, aggregation: Aggregation): Reducer => ({
  id,
  filter,
  aggregation,
});

const matchAll = (filter: Filter) => {
  const matches = getMatcher(filter);
  for (const event of events) matches(event);
};

describe("getMatcher", () => {
  const operators: FilterClause["operator"][] = ["eq", "ne", "gt", "gte", "lt", "lte"];
  for (const operator of operators) {
    bench(`${operator} on a metadata number`, () => {
      matchAll(all(clause("metadata.tokens", operator, 6_000)));
    });
  }
  bench("eq on the event name", () => {
    matchAll(all(clause("name", "eq", "llm.call")));
  });
  bench("eq on a nested metadata string", () => {
    matchAll(all(clause("metadata._llm.vendor", "eq", "anthropic")));
  });
  bench("and of three clauses", () => {
    matchAll(
      all(
        clause("name", "eq", "llm.call"),
        clause("metadata.tokens", "gt", 1_000),
        clause("metadata.model", "ne", "gpt-5"),
      ),
    );
  });
  bench("or of three clauses", () => {
    matchAll(
      any(
        clause("name", "eq", "embedding"),
        clause("metadata.tokens", "gt", 11_000),
        clause("metadata.model", "eq", "gemini-3-pro"),
      ),
    );
  });
  bench("and of an or and a clause", () => {
    matchAll(
      all(
        any(clause("name", "eq", "llm.call"), clause("name", "eq", "embedding")),
        clause("metadata.tokens", "gte", 500),
      ),
    );
  });
});

describe("reduce", () => {
  const aggregations: Aggregation[] = [
    { func: "count" },
    { func: "sum", property: "metadata.tokens" },
    { func: "min", property: "metadata.tokens" },
    { func: "max", property: "metadata.tokens" },
    { func: "avg", property: "metadata.tokens" },
  ];
  for (const aggregation of aggregations) {
    const matchers = withMatchers([
      reducerOf("tokens", all(clause("name", "eq", "llm.call")), aggregation),
    ]);
    bench(`${aggregation.func}, one reducer, 1,000 events`, () => {
      reduce(matchers, events, oldestBucketStart);
    });
  }
  const tenReducers = Array.from({ length: 10 }, (_, index) =>
    reducerOf(
      `reducer-${index}`,
      all(
        clause("name", "eq", NAMES[index % NAMES.length]),
        clause("metadata.tokens", "gte", index * 1_000),
      ),
      { func: "sum", property: "metadata.tokens" },
    ),
  );
  const tenMatchers = withMatchers(tenReducers);
  bench("sum, ten reducers, 1,000 events", () => {
    reduce(tenMatchers, events, oldestBucketStart);
  });
  const llmCall = events.find((event) => event.name === "llm.call")!;
  const oneMatcher = withMatchers([tenReducers[0]]);
  bench("sum, one reducer, one matching event", () => {
    reduce(oneMatcher, [llmCall], oldestBucketStart);
  });
});
