import benchmark from "./benchmark.json";
import { BUCKET_SIZE, type Reducer } from "./reducer";

// 5-minute buckets: 5 minutes, 1 hour, 24 hours of usage since the last snapshot.
export const {
  cold_until: COLD_UNTIL,
  bucket_counts: BUCKET_COUNTS,
  channel: CHANNEL,
  epoch: EPOCH,
  snapshot: SNAPSHOT,
} = benchmark;
export const REDUCER = benchmark.reducer as Reducer;
export const CREDIT_REDUCER = benchmark.credit_reducer as Reducer;
// Events pending in one bucket: a batch the buffer just delivered, and a backlog after a 429.
export const PENDING_COUNTS = [1, 100, 1000];
// What WRITE_BUCKET stores per event: its value.
const PENDING_ENTRY = "7";

export const pendingIds = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `event-${i}`);

// The `pending:<start>:<statistic>` fields of a bucket with `count` events of 7 units pending.
export const encodePending = (start: number, count: number): string[] => [
  `pending:${start}:count`,
  String(count),
  `pending:${start}:sum`,
  String(7 * count),
  `pending:${start}:min`,
  "7",
  `pending:${start}:max`,
  "7",
];

// The pending hash of a bucket: one entry per event id.
export const pendingEntries = (ids: string[]): string[] => ids.flatMap((id) => [id, PENDING_ENTRY]);

// The flat field list decodeState reads: one `bucket:<start>:<statistic>` entry per bucket.
export const encodeState = (buckets: number): string[] => {
  const fields = [
    "epoch",
    EPOCH,
    "revision",
    "4242",
    "cold_until",
    String(COLD_UNTIL),
    "snapshot_version",
    String(COLD_UNTIL + 1),
    "cold:count",
    "1000",
    "cold:sum",
    "123456",
    "cold:min",
    "1",
    "cold:max",
    "999",
  ];
  for (let index = 0; index < buckets; index++) {
    const prefix = `bucket:${COLD_UNTIL + index * BUCKET_SIZE}:`;
    fields.push(`${prefix}count`, "10", `${prefix}sum`, String(100 + index));
    fields.push(`${prefix}min`, "1", `${prefix}max`, String(50 + index));
  }
  return fields;
};
