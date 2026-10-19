import benchmark from "./benchmark.json";
import { BUCKET_SIZE } from "./reducer";

// 5-minute buckets: 5 minutes, 1 hour, 24 hours of usage since the last snapshot.
export const {
  cold_until: COLD_UNTIL,
  bucket_counts: BUCKET_COUNTS,
  channel: CHANNEL,
  epoch: EPOCH,
} = benchmark;

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
    "credited:meter",
    "1000000",
  ];
  for (let index = 0; index < buckets; index++) {
    const prefix = `bucket:${COLD_UNTIL + index * BUCKET_SIZE}:`;
    fields.push(`${prefix}count`, "10", `${prefix}sum`, String(100 + index));
    fields.push(`${prefix}min`, "1", `${prefix}max`, String(50 + index));
  }
  return fields;
};
