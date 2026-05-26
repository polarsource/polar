import { describe, expect, it } from 'vitest'
import {
  buildBillingPlanUrls,
  readBillingPlanCancelPayload,
  readBillingPlanCompletePayload,
} from './billingPlanTelemetry'

const ORIGIN = 'https://app.example.com'

const sp = (query: string) => new URLSearchParams(query)

describe('buildBillingPlanUrls', () => {
  it('encodes source + attribution on the success URL', () => {
    const { success_url } = buildBillingPlanUrls({
      source: 'plan_upsell',
      attribution: {
        plan_name: 'Growth',
        plan_product_id: 'prod_growth',
        monthly_savings_cents: 30000,
      },
      origin: ORIGIN,
      successPath: '/dashboard/acme/settings/billing',
      cancelPath: '/dashboard/acme',
    })

    const url = new URL(success_url)
    expect(url.origin).toBe(ORIGIN)
    expect(url.pathname).toBe('/dashboard/acme/settings/billing')
    expect(url.searchParams.get('checkout_success')).toBe('true')
    expect(url.searchParams.get('source')).toBe('plan_upsell')
    expect(url.searchParams.get('plan_name')).toBe('Growth')
    expect(url.searchParams.get('plan_product_id')).toBe('prod_growth')
    expect(url.searchParams.get('monthly_savings_cents')).toBe('30000')
  })

  it('does not pollute the URL with utm_* params', () => {
    const { success_url, return_url } = buildBillingPlanUrls({
      source: 'plan_upsell',
      attribution: { plan_name: 'Pro', plan_product_id: 'prod_pro' },
      origin: ORIGIN,
      successPath: '/x',
      cancelPath: '/y',
    })
    for (const url of [new URL(success_url), new URL(return_url)]) {
      expect(url.searchParams.get('utm_source')).toBeNull()
      expect(url.searchParams.get('utm_medium')).toBeNull()
      expect(url.searchParams.get('utm_campaign')).toBeNull()
    }
  })

  it('encodes source + attribution on the cancel URL pointing back to cancelPath', () => {
    const { return_url } = buildBillingPlanUrls({
      source: 'change_plan',
      attribution: { plan_name: 'Pro', plan_product_id: 'prod_pro' },
      origin: ORIGIN,
      successPath: '/dashboard/acme/settings/billing',
      cancelPath: '/dashboard/acme/settings/billing/change-plan',
    })

    const url = new URL(return_url)
    expect(url.pathname).toBe('/dashboard/acme/settings/billing/change-plan')
    expect(url.searchParams.get('checkout_canceled')).toBe('true')
    expect(url.searchParams.get('source')).toBe('change_plan')
    expect(url.searchParams.get('plan_name')).toBe('Pro')
  })

  it('omits monthly_savings_cents when not provided', () => {
    const { success_url } = buildBillingPlanUrls({
      source: 'change_plan',
      attribution: { plan_name: 'Pro', plan_product_id: 'prod_pro' },
      origin: ORIGIN,
      successPath: '/x',
      cancelPath: '/y',
    })
    expect(
      new URL(success_url).searchParams.get('monthly_savings_cents'),
    ).toBeNull()
  })

  it('treats null monthly_savings_cents as absent', () => {
    const { success_url } = buildBillingPlanUrls({
      source: 'plan_upsell',
      attribution: {
        plan_name: 'Pro',
        plan_product_id: 'prod_pro',
        monthly_savings_cents: null,
      },
      origin: ORIGIN,
      successPath: '/x',
      cancelPath: '/y',
    })
    expect(
      new URL(success_url).searchParams.get('monthly_savings_cents'),
    ).toBeNull()
  })

  it('encodes the from_plan_* fields when provided', () => {
    const { success_url } = buildBillingPlanUrls({
      source: 'change_plan',
      attribution: {
        plan_name: 'Growth',
        plan_product_id: 'prod_growth',
        from_plan_name: 'Pro',
        from_plan_product_id: 'prod_pro',
        from_plan_amount_cents: 2000,
      },
      origin: ORIGIN,
      successPath: '/x',
      cancelPath: '/y',
    })
    const params = new URL(success_url).searchParams
    expect(params.get('from_plan_name')).toBe('Pro')
    expect(params.get('from_plan_product_id')).toBe('prod_pro')
    expect(params.get('from_plan_amount_cents')).toBe('2000')
  })

  it('omits from_plan_* fields when null/undefined (e.g. checkout from free)', () => {
    const { success_url } = buildBillingPlanUrls({
      source: 'plan_upsell',
      attribution: {
        plan_name: 'Pro',
        plan_product_id: 'prod_pro',
        from_plan_name: null,
        from_plan_product_id: null,
        from_plan_amount_cents: null,
      },
      origin: ORIGIN,
      successPath: '/x',
      cancelPath: '/y',
    })
    const params = new URL(success_url).searchParams
    expect(params.get('from_plan_name')).toBeNull()
    expect(params.get('from_plan_product_id')).toBeNull()
    expect(params.get('from_plan_amount_cents')).toBeNull()
  })

  it('round-trips zero savings (a real value, not absent)', () => {
    const { success_url } = buildBillingPlanUrls({
      source: 'plan_upsell',
      attribution: {
        plan_name: 'Pro',
        plan_product_id: 'prod_pro',
        monthly_savings_cents: 0,
      },
      origin: ORIGIN,
      successPath: '/x',
      cancelPath: '/y',
    })
    expect(new URL(success_url).searchParams.get('monthly_savings_cents')).toBe(
      '0',
    )
  })
})

describe('readBillingPlanCancelPayload', () => {
  it('returns the full payload when canceled and source matches', () => {
    const params = sp(
      '?checkout_canceled=true&source=plan_upsell&plan_name=Growth&plan_product_id=prod_growth&from_plan_name=Pro&from_plan_product_id=prod_pro&from_plan_amount_cents=2000',
    )
    const payload = readBillingPlanCancelPayload(params, 'org_1', 'plan_upsell')
    expect(payload).toEqual({
      organization_id: 'org_1',
      source: 'plan_upsell',
      plan_name: 'Growth',
      plan_product_id: 'prod_growth',
      from_plan_name: 'Pro',
      from_plan_product_id: 'prod_pro',
      from_plan_amount_cents: 2000,
    })
  })

  it('returns null when checkout_canceled flag is missing', () => {
    const params = sp('?source=plan_upsell')
    expect(
      readBillingPlanCancelPayload(params, 'org_1', 'plan_upsell'),
    ).toBeNull()
  })

  it('returns null when source does not match (different surface)', () => {
    const params = sp('?checkout_canceled=true&source=change_plan')
    expect(
      readBillingPlanCancelPayload(params, 'org_1', 'plan_upsell'),
    ).toBeNull()
  })

  it('fills missing optional fields with null', () => {
    const params = sp('?checkout_canceled=true&source=plan_upsell')
    expect(
      readBillingPlanCancelPayload(params, 'org_1', 'plan_upsell'),
    ).toEqual({
      organization_id: 'org_1',
      source: 'plan_upsell',
      plan_name: null,
      plan_product_id: null,
      from_plan_name: null,
      from_plan_product_id: null,
      from_plan_amount_cents: null,
    })
  })
})

describe('readBillingPlanCompletePayload', () => {
  it('returns the full payload including parsed savings and previous plan', () => {
    const params = sp(
      '?checkout_success=true&source=plan_upsell&plan_name=Growth&plan_product_id=prod_growth&monthly_savings_cents=30000&from_plan_name=Pro&from_plan_product_id=prod_pro&from_plan_amount_cents=2000',
    )
    expect(readBillingPlanCompletePayload(params, 'org_1')).toEqual({
      organization_id: 'org_1',
      source: 'plan_upsell',
      plan_name: 'Growth',
      plan_product_id: 'prod_growth',
      monthly_savings_cents: 30000,
      from_plan_name: 'Pro',
      from_plan_product_id: 'prod_pro',
      from_plan_amount_cents: 2000,
    })
  })

  it('fills from_plan_* with null when absent (e.g. upgrade from free)', () => {
    const params = sp(
      '?checkout_success=true&source=plan_upsell&plan_name=Pro&plan_product_id=prod_pro',
    )
    const payload = readBillingPlanCompletePayload(params, 'org_1')
    expect(payload?.from_plan_name).toBeNull()
    expect(payload?.from_plan_product_id).toBeNull()
    expect(payload?.from_plan_amount_cents).toBeNull()
  })

  it('returns null when checkout_success flag is missing', () => {
    const params = sp('?source=plan_upsell')
    expect(readBillingPlanCompletePayload(params, 'org_1')).toBeNull()
  })

  it('returns null when source is missing (gated against accidental fires)', () => {
    const params = sp('?checkout_success=true')
    expect(readBillingPlanCompletePayload(params, 'org_1')).toBeNull()
  })

  it('parses savings as a number', () => {
    const params = sp(
      '?checkout_success=true&source=change_plan&monthly_savings_cents=18000',
    )
    const payload = readBillingPlanCompletePayload(params, 'org_1')
    expect(payload?.monthly_savings_cents).toBe(18000)
  })

  it('leaves savings null when absent', () => {
    const params = sp('?checkout_success=true&source=change_plan')
    const payload = readBillingPlanCompletePayload(params, 'org_1')
    expect(payload?.monthly_savings_cents).toBeNull()
  })
})
