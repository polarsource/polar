import { describe, expect, it } from 'vitest'
import {
  remainingSubscriptionCount,
  reviewCatalogEmptyKind,
  reviewPrimaryAction,
} from './reviewCatalog'

describe('reviewPrimaryAction', () => {
  it('continues when every importable subscription is already prepared', () => {
    expect(reviewPrimaryAction(0, 28)).toBe('continue')
  })

  it('prepares while anything is left to prepare', () => {
    expect(reviewPrimaryAction(3, 28)).toBe('prepare')
    expect(reviewPrimaryAction(3, 0)).toBe('prepare')
  })

  it('does not offer to continue with nothing ready', () => {
    expect(reviewPrimaryAction(0, 0)).toBe('prepare')
  })
})

describe('remainingSubscriptionCount', () => {
  it('excludes already switched subscriptions from the All tab', () => {
    expect(remainingSubscriptionCount(58, 58)).toBe(0)
    expect(remainingSubscriptionCount(58, 20)).toBe(38)
  })
})

describe('reviewCatalogEmptyKind', () => {
  it('treats a zero catalog as nothing in Stripe', () => {
    expect(reviewCatalogEmptyKind(0, 0, false)).toBe('no_stripe_subscriptions')
  })

  it('does not claim Stripe is empty when every subscription is already switched', () => {
    expect(reviewCatalogEmptyKind(58, 58, false)).toBe('all_switched')
    expect(reviewCatalogEmptyKind(58, 58, false)).not.toBe(
      'no_stripe_subscriptions',
    )
  })

  it('shows the table when any subscription still needs work', () => {
    expect(reviewCatalogEmptyKind(58, 20, false)).toBeNull()
  })
})
