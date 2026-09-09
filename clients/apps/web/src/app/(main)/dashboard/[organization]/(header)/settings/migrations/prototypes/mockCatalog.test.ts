import { describe, expect, it } from 'vitest'
import {
  IssueCode,
  mockMigration,
  mockSubscriptions,
  SubscriptionCategory,
} from './mockData'
import {
  buildTransferReceipt,
  getCleanSubscriptions,
  getInitialTotals,
  getIssueCodes,
  getOwnershipForTransfer,
  getProblemCategoryTotals,
  getProblemSubscriptions,
  getRepresentativeSubscriptions,
  resolveBillingOwner,
} from './selectors'

const REQUIRED_ISSUE_CODES: IssueCode[] = [
  'customer_missing_country',
  'product_exists_in_polar',
  'customer_stripe_id_conflict',
  'missing_payment_method',
  'expired_card',
  'cancel_at_period_end',
  'multiple_line_items',
  'unsupported_quantity',
  'subscription_has_discount',
  'send_invoice_collection',
  'subscription_not_importable',
  'customer_missing_email',
  'renewal_inside_safety_window',
  'plan_changed_after_assessment',
  'customer_already_subscribed',
  'payment_method_requires_reentry',
]

describe('migration prototype mock catalog', () => {
  it('exposes exactly 20 clean, 16 problem, and 36 total records', () => {
    const totals = getInitialTotals()

    expect(totals.total).toBe(36)
    expect(totals.clean).toBe(20)
    expect(totals.problems).toBe(16)
    expect(totals.canarySelectable).toBe(20)
    expect(totals.stripeOwned).toBe(36)
    expect(totals.polarOwned).toBe(0)
    expect(totals.unknownOwned).toBe(0)
    expect(mockSubscriptions).toHaveLength(36)
  })

  it('keeps clean ids stable and canary-selectable', () => {
    const clean = getCleanSubscriptions()

    expect(clean).toHaveLength(20)
    expect(clean.every((record) => record.id.startsWith('sub_clean_'))).toBe(
      true,
    )
    expect(new Set(clean.map((record) => record.id)).size).toBe(20)
    expect(clean.every((record) => record.canarySelectable)).toBe(true)
    expect(clean.every((record) => record.issueCode === 'none')).toBe(true)
  })

  it('separates matching payment methods from customer actions', () => {
    expect(mockMigration.cards.matching).toBe(33)
    expect(mockMigration.cards.customerAction).toBe(3)
    expect(
      mockMigration.cards.matching + mockMigration.cards.customerAction,
    ).toBe(mockSubscriptions.length)
  })

  it('covers all 16 unique issue codes including key edge cases', () => {
    const problems = getProblemSubscriptions()
    const codes = getIssueCodes()

    expect(problems).toHaveLength(16)
    expect(codes).toHaveLength(16)
    expect(codes).toEqual([...REQUIRED_ISSUE_CODES].sort())
    expect(new Set(problems.map((record) => record.issueCode)).size).toBe(16)
    expect(
      problems.every(
        (record) =>
          !record.canarySelectable && record.billingOwner === 'stripe',
      ),
    ).toBe(true)

    const missingEmail = problems.find(
      (record) => record.issueCode === 'customer_missing_email',
    )
    expect(missingEmail?.customerEmail).toBeNull()
    expect(codes).toContain('payment_method_requires_reentry')
    expect(codes).toContain('customer_missing_country')
    expect(codes).toContain('renewal_inside_safety_window')
    expect(codes).toContain('customer_already_subscribed')
  })

  it('sums problem category totals to the problem count', () => {
    const totals = getProblemCategoryTotals()
    const categories = Object.keys(totals) as Exclude<
      SubscriptionCategory,
      'clean'
    >[]

    expect(categories.sort()).toEqual(
      [
        'customer',
        'cutover',
        'identity',
        'lifecycle',
        'payment',
        'pricing',
        'product',
      ].sort(),
    )
    expect(Object.values(totals).reduce((sum, value) => sum + value, 0)).toBe(
      16,
    )
    expect(totals.pricing).toBeGreaterThanOrEqual(4)
    expect(totals.cutover).toBeGreaterThanOrEqual(3)
  })

  it('builds a transfer receipt with 20 moved, 16 remaining, 0 unknown', () => {
    const receipt = buildTransferReceipt()

    expect(receipt.moved).toBe(20)
    expect(receipt.polarOwned).toBe(20)
    expect(receipt.remainingProblems).toBe(16)
    expect(receipt.stripeOwned).toBe(16)
    expect(receipt.unknownOwned).toBe(0)
    expect(receipt.movedIds).toHaveLength(20)
    expect(receipt.stripeOwnedIds).toHaveLength(16)
    expect(receipt.stripeOwnedIds).toEqual(
      getProblemSubscriptions().map((record) => record.id),
    )
    expect(
      receipt.movedIds.every((id) => !receipt.stripeOwnedIds.includes(id)),
    ).toBe(true)
  })

  it('records mockMigration.transfer as 20 moved and 16 stripe-owned', () => {
    expect(mockMigration.transfer.moved).toBe(20)
    expect(mockMigration.transfer.selected).toBe(20)
    expect(mockMigration.transfer.stripe).toBe(16)
    expect(mockMigration.transfer.recovery).toBe(0)
    expect(mockMigration.transfer.unknown).toBe(0)
  })

  it('keeps problem records Stripe-owned after transfer', () => {
    expect(getOwnershipForTransfer(false)).toEqual({
      stripeOwned: 36,
      polarOwned: 0,
      unknownOwned: 0,
    })
    expect(getOwnershipForTransfer(true)).toEqual({
      polarOwned: 20,
      stripeOwned: 16,
      unknownOwned: 0,
    })

    for (const record of getProblemSubscriptions()) {
      expect(resolveBillingOwner(record, true)).toBe('stripe')
    }
    for (const record of getCleanSubscriptions()) {
      expect(resolveBillingOwner(record, true)).toBe('polar')
    }
  })

  it('returns a small representative list for UI surfaces', () => {
    const list = getRepresentativeSubscriptions()

    expect(list.length).toBeGreaterThanOrEqual(6)
    expect(list.length).toBeLessThanOrEqual(8)
    expect(list.filter((item) => item.canarySelectable)).toHaveLength(3)
    expect(
      list.some((item) => item.issueCode === 'customer_missing_country'),
    ).toBe(true)
    expect(
      list.every((item) => item.id && item.customerLabel && item.title),
    ).toBe(true)
  })
})
