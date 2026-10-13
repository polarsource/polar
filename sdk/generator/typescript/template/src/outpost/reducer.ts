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
