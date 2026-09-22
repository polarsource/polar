import { describe, expect, it } from 'vitest'
import { CATALOG_READ_DURATION } from '../catalogReadCopy'
import {
  catalogEmptyPanelCopy,
  remainingSubscriptionCount,
  reviewCatalogEmptyKind,
} from './reviewCatalog'

describe('remainingSubscriptionCount', () => {
  it('excludes already switched subscriptions from the All tab', () => {
    expect(remainingSubscriptionCount(58, 58)).toBe(0)
    expect(remainingSubscriptionCount(58, 20)).toBe(38)
  })
})

describe('reviewCatalogEmptyKind', () => {
  it('treats a zero catalog as nothing in Stripe', () => {
    expect(reviewCatalogEmptyKind(0, 0)).toBe('no_stripe_subscriptions')
  })

  it('does not claim Stripe is empty when every subscription is already switched', () => {
    expect(reviewCatalogEmptyKind(58, 58)).toBe('all_switched')
    expect(reviewCatalogEmptyKind(58, 58)).not.toBe('no_stripe_subscriptions')
  })

  it('shows the table when any subscription still needs work', () => {
    expect(reviewCatalogEmptyKind(58, 20)).toBeNull()
  })
})

describe('catalogEmptyPanelCopy', () => {
  it('does not claim the catalog is empty while a refresh is running', () => {
    expect(catalogEmptyPanelCopy({ mode: 'refreshing' })).toEqual({
      title: 'Refreshing from Stripe',
      description: `We're reading your Stripe catalog again. ${CATALOG_READ_DURATION}.`,
    })
  })

  it('keeps the settled empty result when nothing is refreshing', () => {
    expect(
      catalogEmptyPanelCopy({
        mode: 'empty',
        kind: 'no_stripe_subscriptions',
      }).title,
    ).toBe('Nothing to import')
    expect(
      catalogEmptyPanelCopy({ mode: 'empty', kind: 'all_switched' }).title,
    ).toBe('All subscriptions already switched')
  })
})
