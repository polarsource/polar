import type { JsonType } from '@posthog/core'

/**
 * Utilities for telemetry around Polar's *own* billing-plan upgrade flow
 * (the checkout that lives behind the dashboard's Pricing settings and the
 * dashboard upsell). Not to be confused with the customer-facing Polar
 * Checkout product — these helpers are exclusively about us tracking how
 * Polar's organizations move between Polar's plans.
 *
 * Attribution is encoded as plain `source=...` query params, not UTM tags.
 * UTM is reserved for external marketing attribution; mixing internal
 * surfaces into UTM pollutes that data.
 */

/**
 * Source — the specific in-product surface that started the billing plan
 * checkout. Persisted as `source` on the redirect URLs and re-emitted on
 * the explicit complete/cancel events so funnels filter cleanly.
 */
export type BillingPlanSource = 'plan_upsell' | 'change_plan'

export interface BillingPlanAttribution {
  /** Target plan name (the one the user is upgrading to). */
  plan_name: string
  /** Target plan product id. */
  plan_product_id: string
  /** Projected monthly savings, when the action originates from the upsell. */
  monthly_savings_cents?: number | null
  /** Name of the plan the user was on when checkout started. Null = free. */
  from_plan_name?: string | null
  /** Product id of the previous plan. Null = free. */
  from_plan_product_id?: string | null
  /** Monthly amount of the previous plan, in cents. Null = free. */
  from_plan_amount_cents?: number | null
}

export interface BillingPlanUrls {
  success_url: string
  return_url: string
}

interface BuildBillingPlanUrlsInput {
  source: BillingPlanSource
  attribution: BillingPlanAttribution
  origin: string
  successPath: string
  cancelPath: string
}

const appendIfPresent = (
  target: Record<string, string>,
  key: string,
  value: number | string | null | undefined,
): void => {
  if (value === null || value === undefined) return
  target[key] = String(value)
}

export const buildBillingPlanUrls = ({
  source,
  attribution,
  origin,
  successPath,
  cancelPath,
}: BuildBillingPlanUrlsInput): BillingPlanUrls => {
  const shared: Record<string, string> = {
    source,
    plan_name: attribution.plan_name,
    plan_product_id: attribution.plan_product_id,
  }
  appendIfPresent(
    shared,
    'monthly_savings_cents',
    attribution.monthly_savings_cents,
  )
  appendIfPresent(shared, 'from_plan_name', attribution.from_plan_name)
  appendIfPresent(
    shared,
    'from_plan_product_id',
    attribution.from_plan_product_id,
  )
  appendIfPresent(
    shared,
    'from_plan_amount_cents',
    attribution.from_plan_amount_cents,
  )
  const successParams = new URLSearchParams({
    checkout_success: 'true',
    ...shared,
  })
  const cancelParams = new URLSearchParams({
    checkout_canceled: 'true',
    ...shared,
  })
  return {
    success_url: `${origin}${successPath}?${successParams.toString()}`,
    return_url: `${origin}${cancelPath}?${cancelParams.toString()}`,
  }
}

interface URLSearchParamsLike {
  get: (key: string) => string | null
}

/**
 * Reads the cancel-event payload from URL search params. Returns null when
 * the URL isn't a cancellation return for the given source, so the caller
 * can short-circuit before firing.
 */
const parseIntOrNull = (raw: string | null): number | null =>
  raw === null ? null : Number(raw)

export const readBillingPlanCancelPayload = (
  searchParams: URLSearchParamsLike,
  organizationId: string,
  source: BillingPlanSource,
): Record<string, JsonType> | null => {
  if (searchParams.get('checkout_canceled') !== 'true') return null
  if (searchParams.get('source') !== source) return null
  return {
    organization_id: organizationId,
    source,
    plan_name: searchParams.get('plan_name') ?? null,
    plan_product_id: searchParams.get('plan_product_id') ?? null,
    from_plan_name: searchParams.get('from_plan_name') ?? null,
    from_plan_product_id: searchParams.get('from_plan_product_id') ?? null,
    from_plan_amount_cents: parseIntOrNull(
      searchParams.get('from_plan_amount_cents'),
    ),
  }
}

/**
 * Reads the complete-event payload. Returns null when there's no
 * `checkout_success=true` OR no `source` (the marker we attach when
 * building the success_url). Internal navigations that use
 * `?checkout_success=true` purely for cache invalidation don't have
 * `source` and therefore don't masquerade as conversions.
 */
export const readBillingPlanCompletePayload = (
  searchParams: URLSearchParamsLike,
  organizationId: string,
): Record<string, JsonType> | null => {
  if (searchParams.get('checkout_success') !== 'true') return null
  const source = searchParams.get('source')
  if (!source) return null
  return {
    organization_id: organizationId,
    source,
    plan_name: searchParams.get('plan_name') ?? null,
    plan_product_id: searchParams.get('plan_product_id') ?? null,
    monthly_savings_cents: parseIntOrNull(
      searchParams.get('monthly_savings_cents'),
    ),
    from_plan_name: searchParams.get('from_plan_name') ?? null,
    from_plan_product_id: searchParams.get('from_plan_product_id') ?? null,
    from_plan_amount_cents: parseIntOrNull(
      searchParams.get('from_plan_amount_cents'),
    ),
  }
}
