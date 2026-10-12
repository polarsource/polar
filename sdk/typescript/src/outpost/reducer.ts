import { getProperty, type Event } from "./event";

export interface FilterClause {
  property: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
  value: string | number | boolean;
}
export interface Filter {
  conjunction: "and" | "or";
  clauses: (Filter | FilterClause)[];
}
export type Aggregation = { func: "count" } | { func: "sum" | "min" | "max"; property: string };
export interface Reducer {
  id: string;
  filter: Filter;
  aggregation: Aggregation;
  meter_ids?: string[];
}
export interface BucketUpdate {
  customer: string;
  reducer: string;
  bucketStart: number;
  func: Aggregation["func"];
  value: number;
}
export const BUCKET_SIZE = 300;

export const getBucketStart = (timestamp: number): number => {
  if (!Number.isFinite(timestamp)) throw new TypeError("Invalid bucket timestamp");
  return Math.floor(timestamp / BUCKET_SIZE) * BUCKET_SIZE;
};

export const getMatcher = (filter: Filter | FilterClause): ((event: Event) => boolean) => {
  if (!("property" in filter)) {
    const children = filter.clauses.map(getMatcher);
    return filter.conjunction === "and"
      ? (event) => children.every((match) => match(event))
      : (event) => children.some((match) => match(event));
  }
  return (event) => {
    const actual = getProperty(event, filter.property);
    if (actual === undefined || actual === null) return false;
    if (typeof actual !== typeof filter.value) return filter.operator === "ne";
    if (filter.operator === "eq") return actual === filter.value;
    if (filter.operator === "ne") return actual !== filter.value;
    if (
      (typeof actual !== "number" && typeof actual !== "string") ||
      (typeof filter.value !== "number" && typeof filter.value !== "string")
    )
      return false;
    switch (filter.operator) {
      case "gt":
        return actual > filter.value;
      case "gte":
        return actual >= filter.value;
      case "lt":
        return actual < filter.value;
      case "lte":
        return actual <= filter.value;
    }
  };
};

export const reduce = (
  reducers: readonly Reducer[],
  events: readonly Event[],
  oldestBucketStart: number,
): BucketUpdate[] => {
  const updates = new Map<string, BucketUpdate>();
  const matchers = reducers.map((reducer) => [reducer, getMatcher(reducer.filter)] as const);
  for (const event of events) {
    const bucketStart = getBucketStart(event.timestamp);
    if (bucketStart < oldestBucketStart) continue;
    for (const [reducer, match] of matchers) {
      if (!match(event)) continue;
      const { aggregation } = reducer;
      const value = aggregation.func === "count" ? 1 : getProperty(event, aggregation.property);
      if (typeof value !== "number") continue;
      if (!Number.isFinite(value)) throw new TypeError("Aggregation values must be finite");
      const key = JSON.stringify([event.customer, reducer.id, bucketStart, aggregation.func]);
      const previous = updates.get(key)?.value;
      const reduced =
        previous === undefined
          ? value
          : aggregation.func === "min"
            ? Math.min(previous, value)
            : aggregation.func === "max"
              ? Math.max(previous, value)
              : previous + value;
      if (!Number.isFinite(reduced)) throw new TypeError("Aggregation values must be finite");
      updates.set(key, {
        customer: event.customer,
        reducer: reducer.id,
        bucketStart,
        func: aggregation.func,
        value: reduced,
      });
    }
  }
  return [...updates.values()];
};

export const parseReducers = (payload: unknown): Reducer[] => {
  const object = (value: unknown): Record<string, unknown> => {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError("Invalid Outpost configuration");
    return value as Record<string, unknown>;
  };
  const filter = (value: unknown, root = false): void => {
    const clause = object(value);
    if (!root && "property" in clause) {
      if (
        typeof clause.property !== "string" ||
        !["eq", "ne", "gt", "gte", "lt", "lte"].includes(String(clause.operator)) ||
        !["string", "number", "boolean"].includes(typeof clause.value) ||
        (typeof clause.value === "number" && !Number.isFinite(clause.value))
      )
        throw new TypeError("Invalid Outpost filter clause");
    } else {
      if (
        (clause.conjunction !== "and" && clause.conjunction !== "or") ||
        !Array.isArray(clause.clauses)
      )
        throw new TypeError("Invalid Outpost filter");
      clause.clauses.forEach((child) => filter(child));
    }
  };
  const reducers = object(payload).reducers;
  if (!Array.isArray(reducers)) throw new TypeError("Invalid Outpost reducers");
  for (const value of reducers) {
    const reducer = object(value);
    const aggregation = object(reducer.aggregation);
    if (
      typeof reducer.id !== "string" ||
      !["count", "sum", "min", "max"].includes(String(aggregation.func)) ||
      (aggregation.func !== "count" && typeof aggregation.property !== "string") ||
      (reducer.meter_ids !== undefined &&
        (!Array.isArray(reducer.meter_ids) ||
          !reducer.meter_ids.every((id) => typeof id === "string")))
    )
      throw new TypeError("Invalid Outpost reducer");
    filter(reducer.filter, true);
  }
  return reducers as Reducer[];
};
