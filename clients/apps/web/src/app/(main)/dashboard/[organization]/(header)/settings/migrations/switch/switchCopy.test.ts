import { describe, expect, it } from 'vitest'
import type { SwitchRow } from './switchRows'
import { periodEndMoveNotice, switchRecordsParams } from './switchCopy'

const row = (overrides: Partial<SwitchRow>): SwitchRow =>
  ({
    cutover_status: null,
    cutover_error: null,
    cancels_at_period_end: null,
    renews_at: null,
    ...overrides,
  }) as SwitchRow

describe('switchRecordsParams', () => {
  it('always lists prepared subscriptions', () => {
    expect(switchRecordsParams('all', 1, 20)).toEqual({
      entity: 'subscriptions',
      dependenciesImported: true,
      page: 1,
      limit: 20,
    })
  })

  it('adds the cutover status on a status tab', () => {
    expect(switchRecordsParams('moved', 2, 50)).toEqual({
      entity: 'subscriptions',
      dependenciesImported: true,
      cutoverStatus: 'moved',
      page: 2,
      limit: 50,
    })
  })
})

describe('periodEndMoveNotice', () => {
  it('says the merchant can move it and it still ends on the renewal date', () => {
    const notice = periodEndMoveNotice(
      row({
        cancels_at_period_end: true,
        renews_at: '2027-01-02T00:00:00.000Z',
      }),
    )

    expect(notice).toContain('You can move it to Polar')
    expect(notice).toContain('will still end on')
    expect(notice).not.toContain('that date')
    expect(notice).not.toContain('stays there')
  })

  it('falls back to that date when the source reported no renewal', () => {
    expect(periodEndMoveNotice(row({ cancels_at_period_end: true }))).toContain(
      'will still end on that date',
    )
  })

  it('rewrites the old left-on-Stripe skip', () => {
    const notice = periodEndMoveNotice(
      row({
        cutover_status: 'skipped',
        cutover_error:
          "It's set to cancel at the end of the period on the source, so there is no renewal for Polar to take over. It stays there until it ends.",
        renews_at: '2027-01-02T00:00:00.000Z',
      }),
    )

    expect(notice).toContain('You can move it to Polar')
    expect(notice).not.toContain('stays there')
  })

  it('keeps a different skip reason in place of the move notice', () => {
    expect(
      periodEndMoveNotice(
        row({
          cancels_at_period_end: true,
          cutover_error: 'No copied card landed on Polar.',
        }),
      ),
    ).toBeNull()
  })

  it('hides the notice once the subscription has moved', () => {
    expect(
      periodEndMoveNotice(
        row({
          cutover_status: 'moved',
          cancels_at_period_end: true,
          renews_at: '2027-01-02T00:00:00.000Z',
        }),
      ),
    ).toBeNull()
  })
})
