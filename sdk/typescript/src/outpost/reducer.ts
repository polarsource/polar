import { getPropertyReader, type Event, type PropertyReader } from "./event";

export interface FilterClause {
  property: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "like" | "not_like";
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

export type EventMatcher = (event: Event) => boolean;
export type ReducerMatchers = readonly (readonly [Reducer, EventMatcher, PropertyReader])[];

export const getMatcher = (filter: Filter | FilterClause): EventMatcher => {
  if (!("property" in filter)) {
    const children = filter.clauses.map(getMatcher);
    if (children.length === 0) return () => true;
    if (children.length === 1) return children[0];
    return filter.conjunction === "and"
      ? (event) => children.every((match) => match(event))
      : (event) => children.some((match) => match(event));
  }
  const read = getPropertyReader(filter.property);
  if (filter.operator === "eq" || filter.operator === "ne") {
    const expected = typeof filter.value === "boolean" ? Number(filter.value) : filter.value;
    const equal = filter.operator === "eq";
    return (event) => {
      const actual = read(event);
      if (actual === undefined || actual === null) return false;
      return ((typeof actual === "boolean" ? Number(actual) : actual) === expected) === equal;
    };
  }
  if (filter.operator === "like" || filter.operator === "not_like") {
    // Polar compares strings; a number or boolean on either side matches nothing.
    const expected = filter.value;
    if (typeof expected !== "string") return () => false;
    const contains = filter.operator === "like";
    return (event) => {
      const actual = read(event);
      return typeof actual === "string" && actual.includes(expected) === contains;
    };
  }
  const expected = filter.value;
  if (typeof expected !== "number" && typeof expected !== "string") return () => false;
  const type = typeof expected;
  switch (filter.operator) {
    case "gt":
      return (event) => {
        const actual = read(event);
        return typeof actual === type && (actual as number | string) > expected;
      };
    case "gte":
      return (event) => {
        const actual = read(event);
        return typeof actual === type && (actual as number | string) >= expected;
      };
    case "lt":
      return (event) => {
        const actual = read(event);
        return typeof actual === type && (actual as number | string) < expected;
      };
    case "lte":
      return (event) => {
        const actual = read(event);
        return typeof actual === type && (actual as number | string) <= expected;
      };
  }
};

export const withMatchers = (reducers: readonly Reducer[]): ReducerMatchers =>
  reducers.map(
    (reducer) =>
      [
        reducer,
        getMatcher(reducer.filter),
        reducer.aggregation.func === "count"
          ? () => 1
          : getPropertyReader(reducer.aggregation.property),
      ] as const,
  );

export const reduce = (
  matchers: ReducerMatchers,
  events: readonly Event[],
  oldestBucketStart: number,
): BucketUpdate[] => {
  const updates = new Map<string, BucketUpdate>();
  for (const event of events) {
    const bucketStart = getBucketStart(event.timestamp);
    if (bucketStart < oldestBucketStart) continue;
    for (let index = 0; index < matchers.length; index++) {
      const [reducer, match, read] = matchers[index];
      if (!match(event)) continue;
      const value = read(event);
      if (typeof value !== "number") continue;
      if (!Number.isFinite(value)) throw new TypeError("Aggregation values must be finite");
      // The customer comes last: the index and the bucket hold no ":".
      const key = `${index}:${bucketStart}:${event.customer}`;
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
      const { statistics } = update;
      if (reducer.aggregation.func === "count") {
        statistics.count += 1;
        continue;
      }
      const total = statistics.sum + value;
      if (!Number.isFinite(total)) throw new TypeError("Aggregation values must be finite");
      statistics.count += 1;
      statistics.sum = total;
      statistics.min = statistics.min === null ? value : Math.min(statistics.min, value);
      statistics.max = statistics.max === null ? value : Math.max(statistics.max, value);
    }
  }
  return [...updates.values()];
};
