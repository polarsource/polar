import { useQuery } from '@tanstack/react-query'
import { voidRequest, voidSearch } from '../api'
import {
  VoidCustomerRecord,
  VoidMetrics,
  VoidProductSubscriptionRecord,
  VoidReducerRecord,
} from '../identityLive'
import { CustomerUsage } from './engine'
import { Scenario } from './types'

export const useSimulationCustomers = (
  organizationId: string,
  scenarios: Scenario[],
) => {
  const slugs = [
    ...new Set(
      scenarios.flatMap((scenario) =>
        [...scenario.baseLevers.meters, ...scenario.levers.meters].map(
          (meter) => meter.reducer,
        ),
      ),
    ),
  ].sort()

  return useQuery({
    queryKey: ['void_simulation_customers', organizationId, slugs],
    enabled: scenarios.length > 0,
    retry: false,
    queryFn: async (): Promise<CustomerUsage[]> => {
      const now = new Date()
      const start = new Date(now)
      start.setUTCDate(start.getUTCDate() - 29)
      start.setUTCHours(0, 0, 0, 0)
      const [customers, subscriptions, reducers] = await Promise.all([
        voidRequest<VoidCustomerRecord[]>(organizationId, '/customers'),
        voidRequest<VoidProductSubscriptionRecord[]>(
          organizationId,
          '/subscriptions?active=true',
        ),
        voidRequest<VoidReducerRecord[]>(organizationId, '/reducers'),
      ])
      const usage = new Map<string, CustomerUsage['units']>()
      await Promise.all(
        slugs.map(async (slug) => {
          const reducer = reducers.find((reducer) => reducer.slug === slug)
          if (!reducer) throw new Error(`Reducer ${slug} not found`)
          const metrics = await voidRequest<VoidMetrics>(
            organizationId,
            `/metrics${voidSearch({
              reducer_id: reducer.id,
              start: start.toISOString(),
              end: now.toISOString(),
              interval: 'day',
              group_by: 'external_root_id',
            })}`,
          )
          for (const series of metrics.series) {
            if (series.external_root_id === null) continue
            const units = usage.get(series.external_root_id) ?? {}
            units[slug] = series.periods.map((period) => period.value ?? 0)
            usage.set(series.external_root_id, units)
          }
        }),
      )
      const names = new Map(
        customers.map((customer) => [customer.external_id, customer.name]),
      )
      return subscriptions.map((subscription) => ({
        id: subscription.external_identity_id,
        name:
          names.get(subscription.external_identity_id) ??
          subscription.external_identity_id,
        plan: subscription.product.slug,
        units: usage.get(subscription.external_identity_id) ?? {},
      }))
    },
  })
}
