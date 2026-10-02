import { CATALOG_READ_DURATION } from '../catalogReadCopy'

export type ReviewCatalogEmptyKind =
  | 'no_stripe_subscriptions'
  | 'subscriptions_on_connected_accounts'
  | 'all_switched'

export function remainingSubscriptionCount(
  total: number,
  imported: number,
): number {
  return Math.max(total - imported, 0)
}

// Only the Stripe account's own data is read, so a Connect platform with no
// subscriptions of its own most likely bills through its connected accounts.
export function reviewCatalogEmptyKind(
  total: number,
  imported: number,
  hasConnectedAccounts: boolean,
): ReviewCatalogEmptyKind | null {
  if (total <= 0) {
    return hasConnectedAccounts
      ? 'subscriptions_on_connected_accounts'
      : 'no_stripe_subscriptions'
  }
  if (remainingSubscriptionCount(total, imported) <= 0) {
    return 'all_switched'
  }
  return null
}

export type ReviewPrimaryAction = 'prepare' | 'continue'

// Subscriptions an earlier migration of the same account already prepared
// arrive ready, leaving nothing to select. The import still has to run once to
// move the migration on, so the merchant continues instead of preparing.
export function reviewPrimaryAction(
  selectable: number,
  ready: number,
): ReviewPrimaryAction {
  return selectable <= 0 && ready > 0 ? 'continue' : 'prepare'
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
  subscriptions_on_connected_accounts: {
    title: 'No subscriptions on this Stripe account',
    description:
      "If you bill your customers through connected accounts, those subscriptions can't be migrated automatically. Contact us at support@polar.sh and we'll look at it with you.",
  },
}

export const CATALOG_REFRESH_COPY = {
  title: 'Refreshing from Stripe',
  description: `We're reading your Stripe catalog again. ${CATALOG_READ_DURATION}.`,
} as const

export const CATALOG_READ_ERROR_TITLE = "We couldn't read your subscriptions"
