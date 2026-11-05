import {
  addStatistics,
  emptyStatistics,
  quantity,
  type Aggregation,
  type BucketStatistics,
} from "./reducer";

export interface Snapshot {
  reducer_id: string;
  customer_id: string | null;
  external_customer_id: string | null;
  customer_exists: boolean;
  version: number;
  cold_until: number;
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
}

// One reducer's state of a customer: what the Lua scripts keep in a Redis hash, as an object.
export interface ReducerState {
  coldUntil?: number;
  snapshotVersion?: number;
  cold: BucketStatistics;
  buckets: Map<number, BucketStatistics>;
  // The part of each bucket Polar has not confirmed yet.
  pending: Map<number, BucketStatistics>;
  // The pending events of each bucket: their value, or null when they only count.
  pendingIds: Map<number, Map<string, number | null>>;
}

// A pending event is forgotten an hour after Polar sealed its bucket.
const SEAL_GRACE = 3_600_000_000;

export const emptyState = (): ReducerState => ({
  cold: emptyStatistics(),
  buckets: new Map(),
  pending: new Map(),
  pendingIds: new Map(),
});

// Every local event counts in its bucket; the pending part is what Polar has not confirmed.
// An id already pending changes nothing.
export const writeBucket = (
  state: ReducerState,
  bucketStart: number,
  statistics: BucketStatistics,
  id: string,
): boolean => {
  let ids = state.pendingIds.get(bucketStart);
  if (!ids) state.pendingIds.set(bucketStart, (ids = new Map()));
  if (ids.has(id)) return false;
  ids.set(id, statistics.min === null ? null : statistics.sum);
  for (const group of [state.buckets, state.pending]) {
    let bucket = group.get(bucketStart);
    if (!bucket) group.set(bucketStart, (bucket = emptyStatistics()));
    addStatistics(bucket, statistics);
  }
  return true;
};

const isSealed = (state: ReducerState, start: number, cutoff: number): boolean => {
  const pending = state.pending.get(start);
  return !pending || pending.count <= 0 || start + SEAL_GRACE < cutoff;
};

// Polar's totals now cover the buckets before the cutoff. The local copy of each is dropped once
// nothing in it is pending: until then, its pending part is what a read adds to Polar's totals.
// An older snapshot, or one already applied, changes nothing.
export const applySnapshot = (state: ReducerState, snapshot: Snapshot): boolean => {
  if (
    (state.coldUntil !== undefined && state.coldUntil > snapshot.cold_until) ||
    (state.snapshotVersion !== undefined && snapshot.version <= state.snapshotVersion)
  )
    return false;
  for (const start of state.buckets.keys())
    if (start < snapshot.cold_until && isSealed(state, start, snapshot.cold_until)) {
      state.buckets.delete(start);
      state.pending.delete(start);
      state.pendingIds.delete(start);
    }
  state.cold = { count: snapshot.count, sum: snapshot.sum, min: snapshot.min, max: snapshot.max };
  state.coldUntil = snapshot.cold_until;
  state.snapshotVersion = snapshot.version;
  return true;
};

// Polar counts these events: they leave the pending part of their bucket. A cold bucket with
// nothing pending left is Polar's alone.
export const confirm = (state: ReducerState, bucketStart: number, ids: string[]): boolean => {
  const entries = state.pendingIds.get(bucketStart);
  const pending = state.pending.get(bucketStart);
  if (!entries || !pending) return false;
  let count = 0;
  let sum = 0;
  for (const id of ids) {
    const value = entries.get(id);
    if (value === undefined) continue;
    entries.delete(id);
    count += 1;
    sum += value ?? 0;
  }
  if (!count) return false;
  pending.count -= count;
  pending.sum -= sum;
  if (pending.count <= 0 || entries.size === 0) {
    state.pending.delete(bucketStart);
    state.pendingIds.delete(bucketStart);
    if (state.coldUntil !== undefined && bucketStart < state.coldUntil)
      state.buckets.delete(bucketStart);
    return true;
  }
  // Extrema cannot be decremented: read them off the events still pending.
  pending.min = null;
  pending.max = null;
  for (const value of entries.values()) {
    if (value === null) continue;
    pending.min = pending.min === null ? value : Math.min(pending.min, value);
    pending.max = pending.max === null ? value : Math.max(pending.max, value);
  }
  return true;
};

// The pending events of the buckets Polar sealed, which only a confirmation settles.
export const sealedPending = (state: ReducerState): [bucketStart: number, ids: string[]][] =>
  state.coldUntil === undefined
    ? []
    : [...state.pendingIds]
        .filter(([start, ids]) => start < state.coldUntil! && ids.size > 0)
        .map(([start, ids]) => [start, [...ids.keys()]]);

// Polar's totals cover the cold buckets: the local read adds what Polar has not confirmed in
// them, and every local event in the buckets Polar has not sealed yet.
export const consumedUnits = (state: ReducerState, func: Aggregation["func"]): number => {
  const combined = { ...state.cold };
  for (const [start, statistics] of state.pending)
    if (start < state.coldUntil!) addStatistics(combined, statistics);
  for (const [start, statistics] of state.buckets)
    if (start >= state.coldUntil!) addStatistics(combined, statistics);
  return quantity(combined, func);
};
