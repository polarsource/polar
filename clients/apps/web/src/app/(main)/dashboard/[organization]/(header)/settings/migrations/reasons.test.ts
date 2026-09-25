import { describe, expect, it } from 'vitest'
import { DISCOUNT_SKIP_NOTICES, migrationReasonNotice } from './reasons'

describe('migrationReasonNotice', () => {
  it('returns the merchant copy for a discount skip', () => {
    expect(migrationReasonNotice('subscription_customer_discount')).toBe(
      DISCOUNT_SKIP_NOTICES.subscription_customer_discount,
    )
    expect(
      migrationReasonNotice('subscription_customer_discount'),
    ).toContain('stays on Stripe')
  })

  it('leaves other reasons to the API copy', () => {
    expect(migrationReasonNotice('multiple_line_items')).toBeNull()
    expect(migrationReasonNotice(null)).toBeNull()
  })
})
