import { useMemo } from 'react'
import { shortVersion, useVoidDeploys, versionLabels, VoidDeploy } from './api'
import { useVoidEvents } from './eventQueries'
import { buildTree, rollup } from './identities'
import {
  composeIdentities,
  toLiveEvent,
  VoidLiveIdentity,
  VoidProductSubscriptionRecord,
} from './identityLive'
import {
  useVoidCustomers,
  useVoidIdentities,
  useVoidIdentityUsage,
} from './identityQueries'
import { useVoidMeters } from './meterQueries'
import { useVoidOverview } from './overviewQueries'
import { monthlyCents, VoidProduct } from './products'
import { useVoidProducts } from './productQueries'
import { useVoidSubscriptions } from './subscriptionQueries'
import {
  VoidDeployment,
  VoidHomeData,
  VoidHomeIdentity,
  VoidPlan,
} from './types'

const EVENT_LIMIT = 6
const DEPLOYMENT_LIMIT = 3

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1)

export const plansOf = (
  subscriptions: VoidProductSubscriptionRecord[],
  products: VoidProduct[],
): VoidPlan[] => {
  const monthly = new Map(
    products.map((product) => [product.slug, monthlyCents(product.price)]),
  )
  const plans = new Map<string, VoidPlan>()
  for (const subscription of subscriptions) {
    if (subscription.status !== 'active') continue
    const { name, slug } = subscription.product
    const plan = plans.get(slug) ?? { name, active: 0, mrr: 0 }
    plan.active += 1
    plan.mrr += monthly.get(slug) ?? 0
    plans.set(slug, plan)
  }
  return [...plans.values()].toSorted((a, b) => b.mrr - a.mrr)
}

export const deploymentsOf = (deploys: VoidDeploy[]): VoidDeployment[] => {
  const labels = versionLabels(deploys)
  return deploys
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, DEPLOYMENT_LIMIT)
    .map((deploy) => ({
      version: labels.get(deploy.version_id) ?? shortVersion(deploy.version_id),
      hash: shortVersion(deploy.version_id),
      time: deploy.created_at,
      status: capitalize(deploy.status ?? 'draft') as VoidDeployment['status'],
    }))
}

/** Spend is the billed metered usage in the window, rolled up to each root. */
export const homeIdentitiesOf = (
  identities: VoidLiveIdentity[],
  usage: Record<string, number> | undefined,
): VoidHomeIdentity[] => {
  const rolled = rollup(buildTree(identities), usage ?? {})
  return identities.map((identity) => ({
    ...identity,
    spend: rolled[identity.id] ?? 0,
  }))
}

export const useVoidHomeData = (organizationId: string, enabled: boolean) => {
  const overviewQuery = useVoidOverview(organizationId, { enabled })
  const identitiesQuery = useVoidIdentities(organizationId, { enabled })
  const customersQuery = useVoidCustomers(organizationId, { enabled })
  const usageQuery = useVoidIdentityUsage(organizationId, { enabled })
  const subscriptionsQuery = useVoidSubscriptions(organizationId, { enabled })
  const productsQuery = useVoidProducts(organizationId, { enabled })
  const deploysQuery = useVoidDeploys(organizationId, { enabled })
  const eventsQuery = useVoidEvents(
    organizationId,
    { limit: EVENT_LIMIT },
    { enabled },
  )
  const meters = useVoidMeters()

  const data = useMemo<VoidHomeData>(
    () => ({
      metrics: overviewQuery.data?.current ?? null,
      previousMetrics: overviewQuery.data?.previous ?? null,
      identities: homeIdentitiesOf(
        composeIdentities(
          identitiesQuery.data ?? [],
          customersQuery.data ?? [],
        ),
        usageQuery.data?.usage,
      ),
      meters: meters.meters,
      plans: plansOf(subscriptionsQuery.data ?? [], productsQuery.data ?? []),
      deployments: deploymentsOf(deploysQuery.data ?? []),
      events: (eventsQuery.data?.items ?? []).map(toLiveEvent),
      eventCount: eventsQuery.data?.pagination.total_count ?? 0,
    }),
    [
      overviewQuery.data,
      identitiesQuery.data,
      customersQuery.data,
      usageQuery.data,
      meters.meters,
      subscriptionsQuery.data,
      productsQuery.data,
      deploysQuery.data,
      eventsQuery.data,
    ],
  )

  const queries = [
    overviewQuery,
    identitiesQuery,
    customersQuery,
    usageQuery,
    subscriptionsQuery,
    productsQuery,
    deploysQuery,
    eventsQuery,
  ]

  return {
    data,
    loading: enabled && (queries.some((q) => q.isLoading) || meters.loading),
    error: enabled
      ? (queries.find((q) => q.error)?.error ?? meters.error ?? null)
      : null,
  }
}
