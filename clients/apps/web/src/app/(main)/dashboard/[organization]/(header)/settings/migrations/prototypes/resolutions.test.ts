import { describe, expect, it } from 'vitest'
import {
  confirmSuggestedBillingCountry,
  emptyResolutionChoices,
  getCountryResolutionImpact,
  getCountryResolutionLabel,
  getIdentityResolutionImpact,
  getIdentityResolutionLabel,
  getProductResolutionImpact,
  getProductResolutionLabel,
  getResolutionChoiceImpact,
  getResolutionChoiceLabel,
  getResolutionCompletionCount,
  isResolutionComplete,
  ProductResolution,
  recommendedResolutionChoices,
  RESOLUTION_DOMAINS,
  SUGGESTED_BILLING_COUNTRY,
} from './resolutions'

describe('resolution selectors', () => {
  it('counts incomplete and complete resolution sets', () => {
    const empty = emptyResolutionChoices()
    expect(getResolutionCompletionCount(empty)).toBe(0)
    expect(isResolutionComplete(empty)).toBe(false)
    expect(RESOLUTION_DOMAINS).toHaveLength(3)

    const partial = {
      ...empty,
      product: 'map_existing_pro' as const,
      country: confirmSuggestedBillingCountry(),
    }
    expect(getResolutionCompletionCount(partial)).toBe(2)
    expect(isResolutionComplete(partial)).toBe(false)
    expect(
      isResolutionComplete({
        ...partial,
        identity: 'link_existing_customer',
      }),
    ).toBe(true)
  })

  it('exposes canonical recommended Polar proposals', () => {
    expect(recommendedResolutionChoices()).toEqual({
      product: 'map_existing_pro',
      country: confirmSuggestedBillingCountry(),
      identity: 'link_existing_customer',
    })
    expect(isResolutionComplete(recommendedResolutionChoices())).toBe(true)
  })

  it('returns null labels until a domain is chosen', () => {
    const empty = emptyResolutionChoices()
    for (const domain of RESOLUTION_DOMAINS) {
      expect(getResolutionChoiceLabel(domain, empty)).toBeNull()
      expect(getResolutionChoiceImpact(domain, empty)).toBeNull()
    }
  })

  it('labels and impacts each product choice with affected count and MRR', () => {
    const choices: ProductResolution[] = [
      'map_existing_pro',
      'create_separate_product',
      'leave_on_stripe',
    ]
    for (const choice of choices) {
      expect(getProductResolutionLabel(choice).length).toBeGreaterThan(0)
      expect(getProductResolutionImpact(choice)).toContain('1 subscription')
      expect(getProductResolutionImpact(choice)).toContain('$19 MRR')
    }
    expect(getProductResolutionLabel('map_existing_pro')).toContain('Polar Pro')
    expect(getProductResolutionImpact('create_separate_product')).toContain(
      'own Polar product',
    )
    expect(getProductResolutionImpact('leave_on_stripe')).toContain(
      'Retains Stripe ownership',
    )
  })

  it('labels UK confirm, alternate country, and leave dispositions', () => {
    const uk = confirmSuggestedBillingCountry()
    expect(uk).toEqual({
      disposition: 'set_country',
      country: SUGGESTED_BILLING_COUNTRY,
    })
    expect(getCountryResolutionLabel(uk)).toBe('Confirm United Kingdom')
    expect(getCountryResolutionImpact(uk)).toContain('United Kingdom')
    expect(getCountryResolutionImpact(uk)).toContain('1 subscription')
    expect(getCountryResolutionImpact(uk)).toContain('$19 MRR')

    const germany = { disposition: 'set_country' as const, country: 'Germany' }
    expect(getCountryResolutionLabel(germany)).toContain('Germany')
    expect(getCountryResolutionImpact(germany)).toContain('Germany')
    expect(getCountryResolutionImpact(germany)).toContain('$19 MRR')

    const leave = { disposition: 'leave_on_stripe' as const }
    expect(getCountryResolutionLabel(leave)).toContain('Stripe')
    expect(getCountryResolutionImpact(leave)).toContain(
      'Retains Stripe ownership',
    )
    expect(getCountryResolutionImpact(leave)).toContain('$19 MRR')
  })

  it('labels and impacts each identity choice with affected count and MRR', () => {
    for (const choice of [
      'link_existing_customer',
      'create_separate_customer',
      'leave_on_stripe',
    ] as const) {
      expect(getIdentityResolutionLabel(choice).length).toBeGreaterThan(0)
      expect(getIdentityResolutionImpact(choice)).toContain('1 subscription')
      expect(getIdentityResolutionImpact(choice)).toContain('$9 MRR')
    }
    expect(getIdentityResolutionImpact('leave_on_stripe')).toContain(
      'Retains Stripe ownership',
    )
  })

  it('exposes domain selectors for leave-on-stripe selections', () => {
    const resolutions = {
      product: 'leave_on_stripe' as const,
      country: { disposition: 'leave_on_stripe' as const },
      identity: 'leave_on_stripe' as const,
    }
    expect(getResolutionChoiceLabel('product', resolutions)).toContain('Stripe')
    expect(getResolutionChoiceLabel('country', resolutions)).toContain('Stripe')
    expect(getResolutionChoiceLabel('identity', resolutions)).toContain(
      'Stripe',
    )
    expect(getResolutionChoiceImpact('product', resolutions)).toContain(
      'Retains Stripe ownership',
    )
  })
})
