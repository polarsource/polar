import { describe, expect, test } from "bun:test";
import { compileMeters } from "../src/compile";
import { product, perUnit } from "../src/dsl";
import { count, lastOf, maxOf, sumOf } from "../src/meter";
import { cents, micros } from "../src/money";
import { canonicalJson } from "../src/serialize";

const plan = product("api-access")
  .meter("tokens", sumOf("amount"), perUnit(micros(2n)))
  .meter("requests", count(), perUnit(micros(50n)))
  .meter("seats", maxOf("amount"), perUnit(cents(500)))
  .build();

describe("compileMeters", () => {
  test("projects each meter line to a Polar meter (filter by name + aggregation)", () => {
    const { meters, warnings } = compileMeters(plan);
    expect(warnings).toEqual([]);
    expect(meters).toEqual([
      {
        name: "requests",
        filter: { conjunction: "and", clauses: [{ property: "name", operator: "eq", value: "requests" }] },
        aggregation: { func: "count" },
      },
      {
        name: "seats",
        filter: { conjunction: "and", clauses: [{ property: "name", operator: "eq", value: "seats" }] },
        aggregation: { func: "max", property: "amount" },
      },
      {
        name: "tokens",
        filter: { conjunction: "and", clauses: [{ property: "name", operator: "eq", value: "tokens" }] },
        aggregation: { func: "sum", property: "amount" },
      },
    ]);
  });

  test("is deterministic — same Plan compiles byte-for-byte identically", () => {
    expect(canonicalJson(compileMeters(plan))).toBe(canonicalJson(compileMeters(plan)));
  });

  test("injects organization_id when provided", () => {
    const { meters } = compileMeters(plan, { organizationId: "org_1" });
    expect(meters.every((m) => m.organization_id === "org_1")).toBe(true);
  });

  test("warns (and skips) on lastOf — no Polar equivalent", () => {
    const p = product("p").meter("gauge", lastOf("level"), perUnit(micros(1n))).build();
    const { meters, warnings } = compileMeters(p);
    expect(meters).toHaveLength(0);
    expect(warnings[0]).toContain('aggregation "last" has no Polar equivalent');
  });

  test("warns on meter names shorter than Polar's 3-char minimum", () => {
    const p = product("p").meter("io", count(), perUnit(micros(1n))).build();
    const { warnings } = compileMeters(p);
    expect(warnings.some((w) => w.includes("at least 3 characters"))).toBe(true);
  });
});
