/**
 * An Aggregation reduces the events matching a meter into a single quantity —
 * the same primitives Polar's meters offer: count events, or sum/max/last over
 * a numeric `metadata` property.
 *
 * Each is a tiny algebra: a `property` it reads from `metadata` (or null for
 * count), an initial state, a pure `step`, and a `result` readout. State is a
 * plain serializable value (bigint / null) so it can be snapshotted and the
 * fold resumed from a checkpoint. Quantities are bigint — metadata values are
 * required to be integers at ingestion (see polar.ts), keeping money math exact.
 */
export type MeterState = bigint | null

export interface Aggregation<S extends MeterState = MeterState> {
  readonly id: string
  /** The metadata key this aggregates over, or null for `count` (which ignores metadata). */
  readonly property: string | null
  readonly init: S
  readonly step: (state: S, value: bigint) => S
  readonly result: (state: S) => bigint
}

/** Count of matching events, regardless of metadata. */
export const count = (): Aggregation<bigint> => ({
  id: 'count',
  property: null,
  init: 0n,
  step: (s) => s + 1n,
  result: (s) => s,
})

/** Sum of `metadata[property]` across matching events. */
export const sumOf = (property: string): Aggregation<bigint> => ({
  id: 'sum',
  property,
  init: 0n,
  step: (s, v) => s + v,
  result: (s) => s,
})

/** Largest `metadata[property]` seen — e.g. peak seats. */
export const maxOf = (property: string): Aggregation<bigint | null> => ({
  id: 'max',
  property,
  init: null,
  step: (s, v) => (s === null || v > s ? v : s),
  result: (s) => s ?? 0n,
})

/** Value of `metadata[property]` on the last matching event (log order) — gauge-style. */
export const lastOf = (property: string): Aggregation<bigint | null> => ({
  id: 'last',
  property,
  init: null,
  step: (_s, v) => v,
  result: (s) => s ?? 0n,
})
