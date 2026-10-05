import { describe, expect, it } from 'vitest'
import { BANK_DEBITS_STAY_BEHIND } from './paymentMethod'
import { reviewStatus } from './reviewStatus'
import type { ReviewRow } from './reviewRows'

const baseRow = {
  record_id: 'rec_1',
  entity: 'subscriptions' as const,
  source_id: 'sub_1',
  title: 'Subscription',
  subtitle: null,
  amount: null,
  currency: null,
  recurring_interval: null,
  reason: null,
  reason_code: null,
  reason_level: null,
  dependencies_imported: null,
  payment_method_type: 'card' as const,
}

function row(overrides: Partial<ReviewRow>): ReviewRow {
  return { ...baseRow, ...overrides } as ReviewRow
}

describe('reviewStatus', () => {
  describe('switched', () => {
    it('shows "Switched" (gray) when import_status is imported', () => {
      expect(reviewStatus(row({ import_status: 'imported' }))).toMatchObject({
        label: 'Switched',
        color: 'gray',
      })
    })

    // `isImported` checks `import_status === 'imported'`, so a precheck-skipped
    // row that somehow ended up imported should still surface as Switched — the
    // runtime outcome wins over the precheck prediction.
    it('prefers "Switched" over a precheck-skipped status', () => {
      expect(
        reviewStatus(row({ status: 'skipped', import_status: 'imported' })),
      ).toMatchObject({ label: 'Switched', color: 'gray' })
    })
  })

  describe('failed', () => {
    it('shows "Failed" (red) when import_status is failed', () => {
      expect(reviewStatus(row({ import_status: 'failed' }))).toMatchObject({
        label: 'Failed',
        color: 'red',
      })
    })
  })

  describe("won't import", () => {
    it('shows "Stays on Stripe" (red) when precheck status is skipped', () => {
      expect(
        reviewStatus(row({ status: 'skipped', import_status: null })),
      ).toMatchObject({ label: 'Stays on Stripe', color: 'red' })
    })

    it('shows "Stays on Stripe" (red) when precheck status is skipped and import is pending', () => {
      expect(
        reviewStatus(row({ status: 'skipped', import_status: 'pending' })),
      ).toMatchObject({ label: 'Stays on Stripe', color: 'red' })
    })

    // Regression test for the reported bug: a record classified `importable`
    // by precheck but skipped at import time (e.g. its dependency wasn't
    // selected) must show "Stays on Stripe", not "Ready".
    it('shows "Stays on Stripe" (red) when import_status is skipped even if status is importable', () => {
      expect(
        reviewStatus(row({ status: 'importable', import_status: 'skipped' })),
      ).toMatchObject({ label: 'Stays on Stripe', color: 'red' })
    })
  })

  describe('needs info', () => {
    it('shows "Needs info" (yellow) when reason_level is action_required and not imported', () => {
      expect(
        reviewStatus(
          row({
            status: 'importable',
            import_status: 'pending',
            reason_level: 'action_required',
          }),
        ),
      ).toMatchObject({ label: 'Needs info', color: 'yellow' })
    })

    it('does not show "Needs info" when the row is imported', () => {
      expect(
        reviewStatus(
          row({
            status: 'importable',
            import_status: 'imported',
            reason_level: 'action_required',
          }),
        ),
      ).toMatchObject({ label: 'Switched', color: 'gray' })
    })
  })

  describe('moving subscriptions', () => {
    it('shows "Ready" for a pending subscription with a card', () => {
      expect(
        reviewStatus(row({ status: 'importable', import_status: 'pending' })),
      ).toMatchObject({ label: 'Ready' })
    })

    it('shows "Prepared" once dependencies are prepared', () => {
      expect(
        reviewStatus(
          row({
            status: 'importable',
            import_status: 'pending',
            dependencies_imported: true,
          }),
        ),
      ).toMatchObject({ label: 'Prepared' })
    })

    it('shows "Needs a card" (yellow) for a prepared subscription without a card', () => {
      expect(
        reviewStatus(
          row({
            status: 'importable',
            import_status: 'pending',
            dependencies_imported: true,
            payment_method_type: 'link',
          }),
        ),
      ).toMatchObject({ label: 'Needs a card', color: 'yellow' })
    })

    it('shows "Ready" for an info-level reason that does not need attention', () => {
      expect(
        reviewStatus(
          row({
            status: 'importable',
            import_status: 'pending',
            reason_level: 'info',
          }),
        ),
      ).toMatchObject({ label: 'Ready' })
    })

    it.each(['link', null] as const)(
      'shows "Needs a card" (yellow) for %s',
      (type) => {
        expect(
          reviewStatus(
            row({ status: 'importable', payment_method_type: type }),
          ),
        ).toMatchObject({ label: 'Needs a card', color: 'yellow' })
      },
    )

    it('keeps "Needs info" ahead of a missing card', () => {
      expect(
        reviewStatus(
          row({
            status: 'importable',
            import_status: 'pending',
            reason_level: 'action_required',
            payment_method_type: 'link',
          }),
        ),
      ).toMatchObject({
        label: 'Needs info',
        color: 'yellow',
        paymentMethod: { kind: 'no_card' },
      })
    })

    it('labels a SEPA subscription by the bank-debit switch', () => {
      expect(
        reviewStatus(
          row({ status: 'importable', payment_method_type: 'sepa_debit' }),
        ),
      ).toMatchObject({
        label: BANK_DEBITS_STAY_BEHIND ? 'Needs a card' : 'Check bank debit',
      })
    })

    it('drops the payment method for failed rows', () => {
      expect(
        reviewStatus(
          row({ import_status: 'failed', payment_method_type: 'link' }),
        ),
      ).toMatchObject({ label: 'Failed', paymentMethod: null })
    })

    it('drops the payment method for rows that stay on Stripe', () => {
      expect(
        reviewStatus(row({ status: 'skipped', payment_method_type: 'link' })),
      ).toMatchObject({ label: 'Stays on Stripe', paymentMethod: null })
    })
  })

  describe('other entities', () => {
    it('shows "Ready" when a pending record has imported dependencies', () => {
      expect(
        reviewStatus(
          row({
            entity: 'customers',
            status: 'importable',
            import_status: 'pending',
            dependencies_imported: true,
          }),
        ),
      ).toMatchObject({ label: 'Ready', paymentMethod: null })
    })

    it('shows "To prepare" when importable and pending', () => {
      expect(
        reviewStatus(
          row({
            entity: 'customers',
            status: 'importable',
            import_status: null,
          }),
        ),
      ).toMatchObject({ label: 'To prepare', paymentMethod: null })
    })
  })
})
