/**
 * Versioned billing rules — "billing as code" with history.
 *
 * A Ruleset pins a Plan to a version and an `effectiveFrom` time. A
 * RulesetHistory is an append-only, time-ordered list of them. Because the fold
 * is pure and rulesets are immutable, two things fall out for free:
 *
 *   Time travel — recompute a past period under the rules *as they then stood*
 *                 (the ruleset effective at the period's start).
 *   What-if     — replay the same usage under a *different* ruleset version.
 *
 * Rulesets live in their own history rather than the usage log (which is now
 * Polar-shaped, with no room for config events). In practice each version is a
 * file in your repo — your VCS is the audit trail; `effectiveFrom` is when it
 * takes over.
 */
import type { Plan } from './dsl'
import { invoice, type Invoice, replay } from './engine'
import { type CustomerRef, inPeriod, type Period } from './events'

export interface Ruleset {
  /** Unique, human-meaningful version id, e.g. "2026.1.0". */
  readonly version: string
  /** Epoch millis; this ruleset governs periods/events at or after this instant. */
  readonly effectiveFrom: number
  readonly plan: Plan
}

export interface RulesetHistory {
  /** Sorted ascending by effectiveFrom; versions unique; effectiveFrom strictly increasing. */
  readonly rulesets: readonly Ruleset[]
}

/** Build a validated history. Throws on duplicate versions or colliding effectiveFrom. */
export const rulesetHistory = (
  rulesets: readonly Ruleset[],
): RulesetHistory => {
  const sorted = [...rulesets].sort((a, b) => a.effectiveFrom - b.effectiveFrom)
  const versions = new Set<string>()
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!
    if (versions.has(r.version))
      throw new Error(`duplicate ruleset version "${r.version}"`)
    versions.add(r.version)
    if (i > 0 && sorted[i - 1]!.effectiveFrom === r.effectiveFrom) {
      throw new Error(
        `two rulesets share effectiveFrom ${r.effectiveFrom} ("${sorted[i - 1]!.version}", "${r.version}")`,
      )
    }
  }
  return { rulesets: sorted }
}

/** The ruleset in effect at `timestamp` — the latest whose effectiveFrom ≤ timestamp. */
export const rulesetAt = (
  history: RulesetHistory,
  timestamp: number,
): Ruleset | undefined => {
  let found: Ruleset | undefined
  for (const r of history.rulesets) {
    if (r.effectiveFrom <= timestamp) found = r
    else break // sorted ascending — no later one can apply
  }
  return found
}

export const rulesetByVersion = (
  history: RulesetHistory,
  version: string,
): Ruleset | undefined => history.rulesets.find((r) => r.version === version)

/** The most recent ruleset — what `syncMeters`/reconcile use as "current". */
export const currentRuleset = (history: RulesetHistory): Ruleset | undefined =>
  history.rulesets[history.rulesets.length - 1]

export interface InvoiceForArgs {
  readonly customer: CustomerRef
  readonly period: Period
  /** Override ruleset selection for a what-if. Defaults to the one effective at period start. */
  readonly version?: string
}

/**
 * Compute an invoice for a customer over a period, under the appropriate
 * ruleset. Default selects the ruleset effective at the period's start
 * (time-travel); pass `version` to bill the same events under a different
 * ruleset (what-if). Pure and deterministic.
 */
export const invoiceFor = (
  history: RulesetHistory,
  events: Parameters<typeof replay>[1],
  args: InvoiceForArgs,
): Invoice => {
  const ruleset = args.version
    ? rulesetByVersion(history, args.version)
    : rulesetAt(history, args.period.from)
  if (!ruleset) {
    throw new Error(
      args.version
        ? `no ruleset with version "${args.version}"`
        : `no ruleset effective at ${new Date(args.period.from).toISOString()}`,
    )
  }
  const scoped = events.filter((e) => inPeriod(e, args.period))
  const state = replay(ruleset.plan, scoped)
  return invoice(ruleset.plan, state, {
    customer: args.customer,
    period: args.period,
    rulesetVersion: ruleset.version,
  })
}
