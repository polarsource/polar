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
export type Aggregation =
  | { func: "count" }
  | { func: "sum" | "min" | "max" | "avg"; property: string };
export interface Reducer {
  id: string;
  filter: Filter;
  aggregation: Aggregation;
  meter_ids?: string[];
}
export interface BucketStatistics {
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
}
export const emptyStatistics = (): BucketStatistics => ({ count: 0, sum: 0, min: null, max: null });
export const addStatistics = (target: BucketStatistics, other: BucketStatistics): void => {
  const total = target.sum + other.sum;
  if (!Number.isFinite(total)) throw new TypeError("Aggregation values must be finite");
  target.count += other.count;
  target.sum = total;
  if (other.min !== null)
    target.min = target.min === null ? other.min : Math.min(target.min, other.min);
  if (other.max !== null)
    target.max = target.max === null ? other.max : Math.max(target.max, other.max);
};
export const quantity = (statistics: BucketStatistics, func: Aggregation["func"]): number => {
  switch (func) {
    case "count":
      return statistics.count;
    case "sum":
      return statistics.sum;
    case "min":
      return statistics.min ?? 0;
    case "max":
      return statistics.max ?? 0;
    case "avg":
      return statistics.count ? statistics.sum / statistics.count : 0;
  }
};
export interface BucketUpdate {
  customer: string;
  reducer: string;
  bucketStart: number;
  statistics: BucketStatistics;
}
export const BUCKET_SIZE = 300_000_000;

export const getBucketStart = (timestamp: number): number => {
  if (!Number.isSafeInteger(timestamp)) throw new TypeError("Invalid bucket timestamp");
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
    if (filter.operator === "eq" || filter.operator === "ne") {
      const actualValue = typeof actual === "boolean" ? Number(actual) : actual;
      const expectedValue = typeof filter.value === "boolean" ? Number(filter.value) : filter.value;
      return filter.operator === "eq"
        ? actualValue === expectedValue
        : actualValue !== expectedValue;
    }
    if (typeof actual !== typeof filter.value) return false;
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
      const key = JSON.stringify([event.customer, reducer.id, bucketStart]);
      let update = updates.get(key);
      if (!update) {
        update = {
          customer: event.customer,
          reducer: reducer.id,
          bucketStart,
          statistics: emptyStatistics(),
        };
        updates.set(key, update);
      }
      addStatistics(
        update.statistics,
        aggregation.func === "count"
          ? { count: 1, sum: 0, min: null, max: null }
          : { count: 1, sum: value, min: value, max: value },
      );
    }
  }
  return [...updates.values()];
};
