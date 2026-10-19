import { bench, describe } from "vitest";

import { BUCKET_COUNTS, encodeState } from "./benchmark";
import { consumedUnits, decodeState } from "./client";

describe("decodeState", () => {
  for (const buckets of BUCKET_COUNTS) {
    const encoded = encodeState(buckets);
    bench(`decode a ${buckets}-bucket state`, () => {
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
