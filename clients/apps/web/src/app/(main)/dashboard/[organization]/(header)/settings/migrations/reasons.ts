import { schemas } from '@polar-sh/client'

export const ENTITY_LABELS: Record<schemas['PrecheckEntity'], string> = {
  subscriptions: 'Subscriptions',
  customers: 'Customers',
  products: 'Products',
  prices: 'Prices',
  discounts: 'Discounts',
}

export const DISCOUNT_SKIP_NOTICES: Record<string, string> = {
  subscription_stacked_discounts:
    "This subscription stacks discounts Polar can't combine into one coupon, so the renewal amount wouldn't match. It stays on Stripe.",
  subscription_customer_discount:
    "This customer has a coupon that also applies to other purchases, not just this subscription. Polar can't keep that without changing what they pay. It stays on Stripe.",
  subscription_item_discount:
    'A discount applies to one item of this subscription, and Polar discounts the whole subscription. Moving it would change the charge, so it stays on Stripe.',
  subscription_discount_currency:
    "This coupon takes a fixed amount off in a currency Polar can't apply to this subscription. It stays on Stripe rather than renewing at a different price.",
  subscription_scheduled_discount:
    "A future phase of this subscription changes its discount. Polar would keep today's coupon, so a later invoice wouldn't match. It stays on Stripe.",
  subscription_invoice_item_discount:
    "An invoice item on this subscription has its own discount. Polar can't apply that to the renewal, so it stays on Stripe.",
}

export function migrationReasonNotice(
  code: string | null | undefined,
): string | null {
  if (!code) return null
  return DISCOUNT_SKIP_NOTICES[code] ?? null
}
