import type { IrMeter, IrProductMeter } from '@void/sdk/config'

/**
 * A browser-side model of how one holder stands on one meter, following the
 * SDK's `BalanceResult` and `CheckResult`. Credits are what the holder has
 * this period: a product's `included` allowance, prepaid grants, or both.
 * `hard` denies past the credits, `soft` bills the overage at the meter's
 * price, `unlimited` never caps. No holder at all is `no_plan`.
 */

export type Holder =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'subscription'
      readonly id: string
      readonly term: IrProductMeter
    }
  | { readonly kind: 'credits'; readonly id: string; readonly granted: number }

export interface Standing {
  readonly usage: number
  readonly credits: number
  readonly remaining: number | null
  readonly overage: number
  readonly limit: IrProductMeter['limit'] | null
  readonly limitedBy: string | null
  readonly reason: 'ok' | 'no_plan'
}

export interface Check extends Omit<Standing, 'reason'> {
  readonly estimate: number
  readonly allowed: boolean
  readonly reason: 'ok' | 'cap' | 'no_plan'
  /** Usage past the credits after the estimate lands, billed at the meter's price. */
  readonly overageAfter: number
  readonly overageCost: number
}

export const standing = (holder: Holder, usage: number): Standing => {
  if (holder.kind === 'none')
    return {
      usage,
      credits: 0,
      remaining: null,
      overage: 0,
      limit: null,
      limitedBy: null,
      reason: 'no_plan',
    }
  const credits =
    holder.kind === 'credits' ? holder.granted : holder.term.included
  const limit = holder.kind === 'credits' ? 'hard' : holder.term.limit
  return {
    usage,
    credits,
    remaining: limit === 'unlimited' ? null : Math.max(0, credits - usage),
    overage: Math.max(0, usage - credits),
    limit,
    limitedBy: holder.id,
    reason: 'ok',
  }
}

export const check = (
  meter: IrMeter,
  holder: Holder,
  usage: number,
  estimate: number,
): Check => {
  const now = standing(holder, usage)
  if (now.reason === 'no_plan')
    return {
      ...now,
      estimate,
      allowed: false,
      reason: 'no_plan',
      overageAfter: 0,
      overageCost: 0,
    }
  const overageAfter = Math.max(0, usage + estimate - now.credits)
  const denied = now.limit === 'hard' && (now.remaining ?? Infinity) < estimate
  return {
    ...now,
    estimate,
    allowed: !denied,
    reason: denied ? 'cap' : 'ok',
    overageAfter: denied ? 0 : overageAfter,
    overageCost: denied ? 0 : overageAfter * meter.unit_amount,
  }
}
