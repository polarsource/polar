import { describe, expect, it } from 'vitest'
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
}

function row(overrides: Partial<ReviewRow>): ReviewRow {
  return { ...baseRow, ...overrides } as ReviewRow
}

describe('reviewStatus', () => {
  describe('imported', () => {
    it('shows "Imported" (gray) when import_status is imported', () => {
      expect(reviewStatus(row({ import_status: 'imported' }))).toEqual({
        label: 'Imported',
        color: 'gray',
      })
    })

    // `isImported` checks `import_status === 'imported'`, so a precheck-skipped
    // row that somehow ended up imported should still surface as Imported — the
    // runtime outcome wins over the precheck prediction.
    it('prefers "Imported" over a precheck-skipped status', () => {
      expect(
        reviewStatus(row({ status: 'skipped', import_status: 'imported' })),
      ).toEqual({ label: 'Imported', color: 'gray' })
    })
  })

  describe('failed', () => {
    it('shows "Import failed" (red) when import_status is failed', () => {
      expect(reviewStatus(row({ import_status: 'failed' }))).toEqual({
        label: 'Import failed',
        color: 'red',
      })
    })
  })

  describe("won't import", () => {
    it('shows "Won\'t import" (red) when precheck status is skipped', () => {
      expect(
        reviewStatus(row({ status: 'skipped', import_status: null })),
      ).toEqual({ label: "Won't import", color: 'red' })
    })

    it('shows "Won\'t import" (red) when precheck status is skipped and import is pending', () => {
      expect(
        reviewStatus(row({ status: 'skipped', import_status: 'pending' })),
      ).toEqual({ label: "Won't import", color: 'red' })
    })

    // Regression test for the reported bug: a record classified `importable`
    // by precheck but skipped at import time (e.g. its dependency wasn't
    // selected) must show "Won't import", not "Ready".
    it('shows "Won\'t import" (red) when import_status is skipped even if status is importable', () => {
      expect(
        reviewStatus(row({ status: 'importable', import_status: 'skipped' })),
      ).toEqual({ label: "Won't import", color: 'red' })
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
      ).toEqual({ label: 'Needs info', color: 'yellow' })
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
      ).toEqual({ label: 'Imported', color: 'gray' })
    })
  })

  describe('ready', () => {
    it('shows "Ready to switch" when a pending subscription has imported dependencies', () => {
      expect(
        reviewStatus(
          row({
            status: 'importable',
            import_status: 'pending',
            dependencies_imported: true,
          }),
        ),
      ).toEqual({ label: 'Ready to switch' })
    })

    it('shows "Ready" when importable and pending with no reason', () => {
      expect(
        reviewStatus(row({ status: 'importable', import_status: 'pending' })),
      ).toEqual({ label: 'Ready' })
    })

    it('shows "Ready" when import_status is null (price rows)', () => {
      expect(
        reviewStatus(row({ status: 'importable', import_status: null })),
      ).toEqual({ label: 'Ready' })
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
      ).toEqual({ label: 'Ready' })
    })
  })
})
