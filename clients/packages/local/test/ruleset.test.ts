import { describe, expect, test } from "vitest";
import { product, perUnit } from "../src/dsl";
import type { Period, UsageEvent } from "../src/events";
import { sumOf } from "../src/meter";
import { micros } from "../src/money";
import { currentRuleset, invoiceFor, rulesetAt, rulesetHistory } from "../src/ruleset";

// v1: $0.000002 / token; v2 (from Feb 1): a price hike to $0.000003 / token.
const v1 = { version: "1.0.0", effectiveFrom: Date.UTC(2026, 0, 1), plan: product("api").meter("tokens", sumOf("amount"), perUnit(micros(2n))).build() };
const v2 = { version: "2.0.0", effectiveFrom: Date.UTC(2026, 1, 1), plan: product("api").meter("tokens", sumOf("amount"), perUnit(micros(3n))).build() };
const history = rulesetHistory([v2, v1]); // unsorted input on purpose

const jan: Period = { from: Date.UTC(2026, 0, 1), to: Date.UTC(2026, 1, 1) };
const feb: Period = { from: Date.UTC(2026, 1, 1), to: Date.UTC(2026, 2, 1) };
const customer = { external_customer_id: "acme" } as const;

const tokens = (seq: number, amount: number, month: number, day: number): UsageEvent => ({
  kind: "usage",
  v: 1,
  seq,
  id: `evt_${seq}`,
  name: "tokens",
  external_customer_id: "acme",
  timestamp: new Date(Date.UTC(2026, month, day)).toISOString(),
  external_id: `k${seq}`,
  metadata: { amount },
});

// 1,000,000 tokens in January and again in February.
const events = [tokens(1, 1_000_000, 0, 15), tokens(2, 1_000_000, 1, 15)];

describe("rulesetHistory", () => {
  test("sorts by effectiveFrom regardless of input order", () => {
    expect(history.rulesets.map((r) => r.version)).toEqual(["1.0.0", "2.0.0"]);
  });

  test("rejects duplicate versions and colliding effectiveFrom", () => {
    expect(() => rulesetHistory([v1, { ...v2, version: "1.0.0" }])).toThrow("duplicate ruleset version");
    expect(() => rulesetHistory([v1, { ...v2, effectiveFrom: v1.effectiveFrom }])).toThrow("share effectiveFrom");
  });

  test("rulesetAt picks the latest effective ruleset; currentRuleset is the newest", () => {
    expect(rulesetAt(history, Date.UTC(2026, 0, 10))?.version).toBe("1.0.0");
    expect(rulesetAt(history, Date.UTC(2026, 2, 10))?.version).toBe("2.0.0");
    expect(rulesetAt(history, Date.UTC(2025, 11, 1))).toBeUndefined(); // before any ruleset
    expect(currentRuleset(history)?.version).toBe("2.0.0");
  });
});

describe("invoiceFor — time travel", () => {
  test("a period is billed under the ruleset effective then", () => {
    const janInv = invoiceFor(history, events, { customer, period: jan });
    expect(janInv.rulesetVersion).toBe("1.0.0");
    expect(janInv.subtotal).toBe(micros(2_000_000n)); // 1,000,000 × 2 µ¢

    const febInv = invoiceFor(history, events, { customer, period: feb });
    expect(febInv.rulesetVersion).toBe("2.0.0");
    expect(febInv.subtotal).toBe(micros(3_000_000n)); // 1,000,000 × 3 µ¢ — the hike
  });
});

describe("invoiceFor — what-if", () => {
  test("the same January usage under v2 yields the v2 price", () => {
    const whatIf = invoiceFor(history, events, { customer, period: jan, version: "2.0.0" });
    expect(whatIf.rulesetVersion).toBe("2.0.0");
    expect(whatIf.subtotal).toBe(micros(3_000_000n)); // Jan tokens, but at v2's rate
  });

  test("throws on an unknown version or a period before any ruleset", () => {
    expect(() => invoiceFor(history, events, { customer, period: jan, version: "9.9.9" })).toThrow('version "9.9.9"');
    const ancient: Period = { from: Date.UTC(2025, 0, 1), to: Date.UTC(2025, 1, 1) };
    expect(() => invoiceFor(history, events, { customer, period: ancient })).toThrow("no ruleset effective");
  });
});
