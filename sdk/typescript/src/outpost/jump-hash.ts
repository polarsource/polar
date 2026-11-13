const MASK = (1n << 64n) - 1n;

export const digestOf = async (key: string): Promise<DataView> =>
  new DataView(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));

/**
 * The bucket a 64-bit hash lands in (Lamping and Veach's jump consistent hash). Going from N to
 * N + 1 buckets moves about 1/(N + 1) of the hashes, all to the new bucket.
 */
export const jump = (hash: bigint, buckets: number): number => {
  let seed = hash;
  let bucket = -1;
  let next = 0;
  while (next < buckets) {
    bucket = next;
    seed = (seed * 2862933555777941757n + 1n) & MASK;
    next = Math.floor((bucket + 1) * (2 ** 31 / (Number(seed >> 33n) + 1)));
  }
  return bucket;
};

export const jumpHash = async (key: string, buckets: number): Promise<number> =>
  jump((await digestOf(key)).getBigUint64(0), buckets);
