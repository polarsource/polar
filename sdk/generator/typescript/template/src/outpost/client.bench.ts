import { bench, describe } from "vitest";

import { consumedUnits, decodeState } from "./client";
import { BUCKET_SIZE } from "./reducer";

const COLD_UNTIL = Date.UTC(2026, 9, 1, 12, 0, 0) * 1_000;
// 5-minute buckets: 5 minutes, 1 hour, 24 hours of usage since the last snapshot.
const BUCKET_COUNTS = [1, 12, 288];

// The flat field list decodeState reads: one `bucket:<start>:<statistic>` entry per bucket.
const encodeState = (buckets: number): string[] => {
  const fields = [
    "epoch",
    "0123456789abcdef0123456789abcdef",
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

describe("decodeState", () => {
  for (const buckets of BUCKET_COUNTS) {
    const encoded = encodeState(buckets);
    bench(`${buckets}-bucket state`, () => {
      decodeState(encoded);
    });
  }
});

describe("consumedUnits", () => {
  for (const buckets of BUCKET_COUNTS) {
    const state = decodeState(encodeState(buckets));
    bench(`sum over a ${buckets}-bucket state`, () => {
      consumedUnits(state, "sum");
    });
  }
});
