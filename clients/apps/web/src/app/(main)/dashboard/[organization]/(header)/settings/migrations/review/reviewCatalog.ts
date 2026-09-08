export type ReviewCatalogEmptyKind = 'no_stripe_subscriptions' | 'all_switched'

export function remainingSubscriptionCount(
  total: number,
  imported: number,
): number {
  return Math.max(total - imported, 0)
}

export function reviewCatalogEmptyKind(
  total: number,
  imported: number,
): ReviewCatalogEmptyKind | null {
  if (total <= 0) {
    return 'no_stripe_subscriptions'
  }
  if (remainingSubscriptionCount(total, imported) <= 0) {
    return 'all_switched'
  }
  return null
}

export const CATALOG_EMPTY_COPY: Record<
  ReviewCatalogEmptyKind,
  { title: string; description: string }
> = {
  all_switched: {
    title: 'All subscriptions already switched',
    description:
      'Every Stripe subscription in this migration is already on Polar. Refresh if you have added more since.',
  },
  no_stripe_subscriptions: {
    title: 'Nothing to import',
    description:
      'We found no subscriptions in Stripe that can move to Polar. If you have added some since, scan again.',
  },
}
