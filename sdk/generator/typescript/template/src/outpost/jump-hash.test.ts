import { describe, expect, it } from "vitest";

import { jumpHash } from "./jump-hash";

const customers = Array.from({ length: 1000 }, (_, index) => `customer-${index}`);
const shardsOf = (count: number) =>
  Promise.all(customers.map((customer) => jumpHash(customer, count)));

describe("jumpHash", () => {
  it("spreads customers over every shard and keeps each one on its shard", async () => {
    const shards = await shardsOf(64);
    expect(await shardsOf(64)).toEqual(shards);
    const sizes = [...new Set(shards)].map(
      (shard) => shards.filter((each) => each === shard).length,
    );
    expect(sizes).toHaveLength(64);
    expect(Math.min(...sizes)).toBeGreaterThan(3);
    expect(Math.max(...sizes)).toBeLessThan(35);
  });

  it("moves only the customers the new shard takes when the count grows", async () => {
    const [before, after] = await Promise.all([shardsOf(64), shardsOf(65)]);
    const moved = after.filter((shard, index) => shard !== before[index]);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.length).toBeLessThan(customers.length / 20);
    expect(moved.every((shard) => shard === 64)).toBe(true);
  });
});
