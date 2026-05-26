import { schemas } from '@polar-sh/client'

type Grant = schemas['CustomerBenefitGrant']

// Benefit types where every grant represents a distinct artefact and must
// stay visible (license keys to redeem, separate OAuth invites, separate
// credit top-ups). All other benefit types resolve to the same underlying
// content regardless of how many times they're granted, so they get
// deduplicated per benefit_id.
const STACK_RELEVANT_TYPES: ReadonlySet<schemas['BenefitType']> = new Set([
  'license_keys',
  'discord',
  'github_repository',
  'meter_credit',
])

export interface SubscriptionGroup {
  subscription: schemas['CustomerBenefitGrantSubscriptionSummary']
  grants: Grant[]
}

export interface GroupedBenefitGrants {
  /**
   * Grants without a single subscription source: order-only grants and
   * dedup-eligible grants shared by more than one subscription.
   */
  shared: Grant[]
  /**
   * One bucket per subscription, sorted by product name for stable ordering.
   */
  bySubscription: SubscriptionGroup[]
}

const grantedAtMillis = (grant: Grant): number =>
  grant.granted_at ? Date.parse(grant.granted_at) : 0

export function groupBenefitGrants(grants: Grant[]): GroupedBenefitGrants {
  const dedupable: Grant[] = []
  const stackRelevant: Grant[] = []
  for (const grant of grants) {
    if (STACK_RELEVANT_TYPES.has(grant.benefit.type)) {
      stackRelevant.push(grant)
    } else {
      dedupable.push(grant)
    }
  }

  // For dedup-eligible benefits, collapse by benefit_id, keeping the
  // most-recently-granted representative and the set of source subscriptions.
  const clusters = new Map<
    string,
    { representative: Grant; subscriptionIds: Set<string> }
  >()
  for (const grant of dedupable) {
    const cluster = clusters.get(grant.benefit_id)
    if (cluster === undefined) {
      clusters.set(grant.benefit_id, {
        representative: grant,
        subscriptionIds: new Set(
          grant.subscription ? [grant.subscription.id] : [],
        ),
      })
      continue
    }
    if (grant.subscription) {
      cluster.subscriptionIds.add(grant.subscription.id)
    }
    if (grantedAtMillis(grant) > grantedAtMillis(cluster.representative)) {
      cluster.representative = grant
    }
  }

  const shared: Grant[] = []
  const bySubscriptionMap = new Map<string, SubscriptionGroup>()

  const placeUnderSubscription = (
    grant: Grant,
    subscription: schemas['CustomerBenefitGrantSubscriptionSummary'],
  ): void => {
    const existing = bySubscriptionMap.get(subscription.id)
    if (existing) {
      existing.grants.push(grant)
    } else {
      bySubscriptionMap.set(subscription.id, {
        subscription,
        grants: [grant],
      })
    }
  }

  for (const cluster of clusters.values()) {
    const { representative, subscriptionIds } = cluster
    if (subscriptionIds.size !== 1 || !representative.subscription) {
      shared.push(representative)
      continue
    }
    placeUnderSubscription(representative, representative.subscription)
  }

  for (const grant of stackRelevant) {
    if (grant.subscription) {
      placeUnderSubscription(grant, grant.subscription)
    } else {
      shared.push(grant)
    }
  }

  const bySubscription = Array.from(bySubscriptionMap.values()).sort((a, b) =>
    a.subscription.product_name.localeCompare(b.subscription.product_name),
  )

  return { shared, bySubscription }
}
