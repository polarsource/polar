import { useQuery } from '@tanstack/react-query'
import { subDays } from 'date-fns'
import { voidKeys, voidRequest, voidSearch } from './api'
import { VoidActivityMix } from './types'
import {
  usageFromMeters,
  VoidCustomerRecord,
  VoidEventsList,
  VoidIdentityDetailRecord,
  VoidIdentityEntitlements,
  VoidIdentityRecord,
  VoidIdentitySnapshot,
  VoidIdentityUsageMaps,
  VoidMeterRecord,
  VoidMetrics,
  VoidProductSubscriptionRecord,
  VoidReducerRecord,
} from './identityLive'

const startOfUtcDay = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )

export const useVoidIdentities = (
  organizationId: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: voidKeys.identities(organizationId),
    queryFn: () =>
      voidRequest<VoidIdentityRecord[]>(organizationId, '/identities'),
    retry: false,
    ...options,
  })

export const useVoidIdentity = (organizationId: string, externalId: string) =>
  useQuery({
    queryKey: voidKeys.identity(organizationId, externalId),
    queryFn: () =>
      voidRequest<VoidIdentityDetailRecord>(
        organizationId,
        `/identities/${encodeURIComponent(externalId)}`,
      ),
    retry: false,
    enabled: Boolean(externalId),
  })

export const useVoidCustomers = (
  organizationId: string,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: voidKeys.customers(organizationId),
    queryFn: () =>
      voidRequest<VoidCustomerRecord[]>(organizationId, '/customers'),
    retry: false,
    ...options,
  })

export const useVoidIdentitySnapshot = (
  organizationId: string,
  externalId: string,
) =>
  useQuery({
    queryKey: voidKeys.identitySnapshot(organizationId, externalId),
    queryFn: () =>
      voidRequest<VoidIdentitySnapshot>(
        organizationId,
        `/identities/${encodeURIComponent(externalId)}/snapshot`,
      ),
    retry: false,
    enabled: Boolean(externalId),
  })

export const useVoidIdentitySubscriptions = (
  organizationId: string,
  externalId: string,
) =>
  useQuery({
    queryKey: voidKeys.identitySubscriptions(organizationId, externalId),
    queryFn: () =>
      voidRequest<VoidProductSubscriptionRecord[]>(
        organizationId,
        `/subscriptions${voidSearch({ external_identity_id: externalId })}`,
      ),
    retry: false,
    enabled: Boolean(externalId),
  })

export const useVoidIdentityEntitlements = (
  organizationId: string,
  externalId: string,
) =>
  useQuery({
    queryKey: voidKeys.identityEntitlements(organizationId, externalId),
    queryFn: () =>
      voidRequest<VoidIdentityEntitlements>(
        organizationId,
        `/identities/${encodeURIComponent(externalId)}/entitlements`,
      ),
    retry: false,
    enabled: Boolean(externalId),
  })

export const useVoidIdentityEvents = (
  organizationId: string,
  externalId: string,
) =>
  useQuery({
    queryKey: voidKeys.identityEvents(organizationId, externalId),
    queryFn: () =>
      voidRequest<VoidEventsList>(
        organizationId,
        `/events${voidSearch({
          external_identity_id: externalId,
          limit: '50',
        })}`,
      ),
    retry: false,
    enabled: Boolean(externalId),
  })

export const useVoidIdentityActivities = (
  organizationId: string,
  externalId: string,
) =>
  useQuery({
    queryKey: voidKeys.identityActivities(organizationId, externalId),
    queryFn: () =>
      voidRequest<VoidActivityMix>(
        organizationId,
        `/activities${voidSearch({ identity: externalId })}`,
      ),
    retry: false,
    enabled: Boolean(externalId),
  })

export const useVoidIdentityUsage = (organizationId: string) =>
  useQuery({
    queryKey: voidKeys.identityUsage(organizationId),
    queryFn: async (): Promise<VoidIdentityUsageMaps> => {
      const now = new Date()
      const start = startOfUtcDay(subDays(now, 29)).toISOString()
      const end = now.toISOString()
      const [meters, reducers] = await Promise.all([
        voidRequest<VoidMeterRecord[]>(organizationId, '/meters'),
        voidRequest<VoidReducerRecord[]>(organizationId, '/reducers'),
      ])
      const perMeter = await Promise.all(
        meters.map((meter) =>
          voidRequest<VoidMetrics>(
            organizationId,
            `/metrics${voidSearch({
              reducer_id: meter.usage_reducer_id,
              start,
              end,
              interval: 'day',
              group_by: 'external_identity_id',
            })}`,
          ),
        ),
      )
      const maps = usageFromMeters(meters, perMeter)
      const spendReducer = reducers.find((reducer) => reducer.slug === 'spend')
      if (!spendReducer) return maps
      const spendMetrics = await voidRequest<VoidMetrics>(
        organizationId,
        `/metrics${voidSearch({
          reducer_id: spendReducer.id,
          start,
          end,
          interval: 'day',
          group_by: 'external_identity_id',
        })}`,
      )
      const spend: Record<string, number> = {}
      for (const entry of spendMetrics.series) {
        const group = entry.external_identity_id ?? entry.external_root_id
        if (group === null) continue
        spend[group] = entry.total ?? 0
      }
      return { ...maps, spend }
    },
    retry: false,
  })
