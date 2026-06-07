/**
 * Load an integrator's billing definition at startup from `LOCAL_BILLING`.
 *
 * The file is a normal TS/JS module that exports `history` (a `RulesetHistory`
 * built with `rulesetHistory(...)` from "@polar-sh/local"). It lives in the
 * integrator's repo, not here — the service just imports it by path. `.ts`
 * works because the service runs under tsx; `.js` works anywhere.
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { RulesetHistory } from './ruleset'

const isRulesetHistory = (value: unknown): value is RulesetHistory =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as { rulesets?: unknown }).rulesets)

export const loadBilling = async (path: string): Promise<RulesetHistory> => {
  let mod: { history?: unknown; default?: unknown }
  try {
    mod = (await import(pathToFileURL(resolve(path)).href)) as typeof mod
  } catch (cause) {
    throw new Error(`could not load LOCAL_BILLING "${path}": ${String(cause)}`)
  }
  const history = mod.history ?? mod.default
  if (!isRulesetHistory(history)) {
    throw new Error(
      `billing module "${path}" must export 'history' — a RulesetHistory built with rulesetHistory(...)`,
    )
  }
  return history
}
