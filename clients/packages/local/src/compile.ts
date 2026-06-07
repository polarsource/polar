/**
 * Compile a local Plan into Polar meter definitions — the forward projection of
 * the "one Plan, two projections" model. The same Plan that drives the local
 * fold (engine.ts) becomes declarative Polar config here, so the two can't drift
 * at definition time. (`push.ts` applies the result; reconciliation later checks
 * they don't drift at runtime either.)
 *
 * Pure and deterministic: same Plan → same meter definitions, byte-for-byte.
 * "Billing config as code" — think Terraform for meters, not uploaded lambdas.
 *
 * local meters map cleanly onto Polar's filter+aggregation model, with one gap:
 * `lastOf` has no Polar aggregation, so it's surfaced as a warning rather than
 * silently mismapped.
 */
import type { MeterLine, Plan } from "./dsl";
import type { MeterAggregation, MeterCreate } from "./polar";
import { METER_NAME_MIN_LENGTH } from "./polar";

export interface CompiledMeters {
  readonly meters: ReadonlyArray<MeterCreate>;
  /** Lines that couldn't be fully/safely projected — review before pushing. */
  readonly warnings: ReadonlyArray<string>;
}

export interface CompileOptions {
  /** Set on every meter; required if the push token isn't an organization token. */
  readonly organizationId?: string;
}

/** Map a local aggregation onto a Polar one, or null (with a warning) if unsupported. */
const toPolarAggregation = (
  line: MeterLine,
  warnings: string[],
): MeterAggregation | null => {
  const { id, property } = line.aggregation;
  switch (id) {
    case "count":
      return { func: "count" };
    case "sum":
      return { func: "sum", property: property! };
    case "max":
      return { func: "max", property: property! };
    case "last":
      warnings.push(
        `meter "${line.name}": aggregation "last" has no Polar equivalent — define this meter manually, or use max/sum`,
      );
      return null;
    default:
      warnings.push(`meter "${line.name}": unknown aggregation "${id}" — skipped`);
      return null;
  }
};

export const compileMeters = (plan: Plan, options: CompileOptions = {}): CompiledMeters => {
  const meters: MeterCreate[] = [];
  const warnings: string[] = [];

  // plan.lines are already sorted by name (the builder sorts), so the output is
  // deterministically ordered.
  for (const line of plan.lines) {
    if (line.name.length < METER_NAME_MIN_LENGTH) {
      warnings.push(
        `meter "${line.name}": Polar meter names must be at least ${METER_NAME_MIN_LENGTH} characters`,
      );
    }
    const aggregation = toPolarAggregation(line, warnings);
    if (!aggregation) continue;

    meters.push({
      name: line.name,
      // Match events whose `name` equals this meter's name — Polar's filter model.
      filter: { conjunction: "and", clauses: [{ property: "name", operator: "eq", value: line.name }] },
      aggregation,
      ...(options.organizationId ? { organization_id: options.organizationId } : {}),
    });
  }

  return { meters, warnings };
};
