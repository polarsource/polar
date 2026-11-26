import { NotReadyError } from "./errors";
import {
  addStatistics,
  emptyStatistics,
  quantity,
  type Aggregation,
  type BucketStatistics,
  type Reducer,
} from "./reducer";

const BUCKET_PREFIX = "bucket:";
const PENDING_PREFIX = "pending:";
export const COLD_PREFIX = "cold:";

export interface State {
  coldUntil?: number;
  cold: BucketStatistics;
  buckets: Map<number, BucketStatistics>;
  // The part of each bucket Polar has not confirmed yet.
  pending: Map<number, BucketStatistics>;
  // The pull's reset count when Polar last answered for it.
  confirmedAfterResets?: number;
}

// A customer's state for one reducer, or `missing` while Polar does not know the customer.
export type Read = State | "missing";

export const number = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new TypeError("Stored aggregation values must be finite numbers");
  return parsed;
};

export const isReady = (read: Read): boolean => read === "missing" || read.coldUntil !== undefined;

export const decodeState = (value: string[]): State => {
  const state: State = {
    coldUntil: undefined,
    cold: emptyStatistics(),
    buckets: new Map(),
    pending: new Map(),
  };
  for (let i = 0; i < value.length; i += 2) {
    const field = value[i];
    const raw = value[i + 1];
    if (field.startsWith("invalid:"))
      throw new NotReadyError("Outpost cannot read an unconfirmed bucket extremum");
    const buckets = field.startsWith(BUCKET_PREFIX)
      ? state.buckets
      : field.startsWith(PENDING_PREFIX)
        ? state.pending
        : undefined;
    if (buckets) {
      const prefix = buckets === state.buckets ? BUCKET_PREFIX : PENDING_PREFIX;
      const separator = field.lastIndexOf(":");
      const start = Number(field.slice(prefix.length, separator));
      let bucket = buckets.get(start);
      if (!bucket) buckets.set(start, (bucket = emptyStatistics()));
      bucket[field.slice(separator + 1) as keyof BucketStatistics] = number(raw);
    } else if (field.startsWith(COLD_PREFIX))
      state.cold[field.slice(COLD_PREFIX.length) as keyof BucketStatistics] = number(raw);
    else if (field === "cold_until") state.coldUntil = number(raw);
    else if (field === "reset") state.confirmedAfterResets = number(raw);
  }
  return state;
};

// The statistics a reducer's quantity adds up: all a read needs of its state.
export const statisticsOf = ({ aggregation }: Reducer): string =>
  aggregation.func === "avg" ? "sum,count" : aggregation.func;

// Polar's totals cover the cold buckets: the local read adds what Polar has not confirmed in
// them, and every local event in the buckets Polar has not sealed yet.
export const consumedUnits = (state: State, func: Aggregation["func"]): number => {
  const combined = { ...state.cold };
  for (const [start, statistics] of state.pending)
    if (start < state.coldUntil!) addStatistics(combined, statistics);
  for (const [start, statistics] of state.buckets)
    if (start >= state.coldUntil!) addStatistics(combined, statistics);
  return quantity(combined, func);
};
