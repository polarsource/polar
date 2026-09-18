import { OrganizationContext } from '@/providers/maintainerOrganization'
import { useQuery } from '@tanstack/react-query'
import { subDays } from 'date-fns'
import { useContext, useMemo } from 'react'
import { useVoidDeploys, voidKeys, voidRequest, voidSearch } from './api'
import { useVoidDataSource } from './dataSource'
import {
  toIdentity,
  VoidIdentityRecord,
  VoidMeterRecord,
  VoidMetrics,
  VoidReducerRecord,
} from './identityLive'
import {
  billedCents,
  FIXTURE_METER_DETAILS,
  metersOfActive,
  rowsOf,
  startOfUtcDay,
  VoidMeterConsumer,
  VoidMeterDetail,
  VoidMeterReducerRef,
  VoidMeterSeries,
} from './meters'
import { useVoidReducerMetrics } from './metricQueries'

const EPOCH = new Date(Date.UTC(2020, 0, 1))

const groupOf = (entry: VoidMetrics['series'][number]) =>
  entry.external_root_id ?? entry.external_identity_id

const seriesOf = (
  recent: VoidMetrics,
  allTime: VoidMetrics,
): VoidMeterSeries => ({
  total: recent.series[0]?.total ?? 0,
  allTime: allTime.series[0]?.total ?? 0,
  periods: recent.series[0]?.periods ?? [],
})

const reducerRef = (
  id: string,
  reducers: Map<string, VoidReducerRecord>,
): VoidMeterReducerRef => {
  const reducer = reducers.get(id)
  return reducer ? { id: reducer.id, slug: reducer.slug } : { id, slug: id }
}

const fetchMetrics = (
  organizationId: string,
  reducerId: string,
  start: Date,
  end: Date,
  interval: 'day' | 'year',
  extra: Record<string, string | undefined> = {},
) =>
  voidRequest<VoidMetrics>(
    organizationId,
    `/metrics${voidSearch({
      reducer_id: reducerId,
      start: start.toISOString(),
      end: end.toISOString(),
      interval,
      ...extra,
    })}`,
  )

const fetchMeterDetail = async (
  organizationId: string,
  id: string,
): Promise<VoidMeterDetail> => {
  const now = new Date()
  const since = startOfUtcDay(subDays(now, 29))
  const [meter, reducers, identities] = await Promise.all([
    voidRequest<VoidMeterRecord>(
      organizationId,
      `/meters/${encodeURIComponent(id)}`,
    ),
    voidRequest<VoidReducerRecord[]>(organizationId, '/reducers'),
    voidRequest<VoidIdentityRecord[]>(organizationId, '/identities'),
  ])
  const [usage, usageAllTime, credits, byRoot] = await Promise.all([
    fetchMetrics(organizationId, meter.usage_reducer_id, since, now, 'day'),
    fetchMetrics(organizationId, meter.usage_reducer_id, EPOCH, now, 'year'),
    fetchMetrics(organizationId, meter.credit_reducer_id, since, now, 'day'),
    fetchMetrics(organizationId, meter.usage_reducer_id, since, now, 'day', {
      group_by: 'external_root_id',
    }),
  ])

  const usageSeries = seriesOf(usage, usageAllTime)
  const nameOf = new Map(
    identities.map((identity) => [
      identity.external_id,
      toIdentity(identity).name,
    ]),
  )
  const reducerById = new Map(reducers.map((reducer) => [reducer.id, reducer]))
  const consumers: VoidMeterConsumer[] = []
  for (const entry of byRoot.series) {
    const consumerId = groupOf(entry)
    const units = entry.total ?? 0
    if (consumerId === null || units <= 0) continue
    consumers.push({
      id: consumerId,
      name: nameOf.get(consumerId) ?? consumerId,
      units,
    })
  }

  return {
    ...meter,
    units: usageSeries.total,
    billed: billedCents(usageSeries.total, meter),
    credits: credits.series[0]?.total ?? 0,
    usage: usageSeries,
    consumers: consumers.toSorted((a, b) => b.units - a.units).slice(0, 8),
    usageReducer: reducerRef(meter.usage_reducer_id, reducerById),
    creditReducer: reducerRef(meter.credit_reducer_id, reducerById),
  }
}

export const useVoidMeters = () => {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  const metersQuery = useQuery({
    queryKey: voidKeys.meters(organization.id),
    queryFn: () => voidRequest<VoidMeterRecord[]>(organization.id, '/meters'),
    retry: false,
    enabled: live,
  })
  const deploysQuery = useVoidDeploys(organization.id, { enabled: live })
  const metricsQuery = useVoidReducerMetrics(organization.id, { enabled: live })

  const meters = useMemo(() => {
    if (!live) return FIXTURE_METER_DETAILS
    return rowsOf(
      metersOfActive(metersQuery.data ?? [], deploysQuery.data ?? []),
      metricsQuery.data ?? [],
    )
  }, [live, metersQuery.data, deploysQuery.data, metricsQuery.data])

  return {
    meters,
    loading:
      live &&
      (metersQuery.isLoading ||
        deploysQuery.isLoading ||
        metricsQuery.isLoading),
    error: live
      ? (metersQuery.error ?? deploysQuery.error ?? metricsQuery.error)
      : null,
  }
}

export const useVoidMeter = (id: string) => {
  const { organization } = useContext(OrganizationContext)
  const live = useVoidDataSource() === 'live'
  const query = useQuery({
    queryKey: voidKeys.meterDetail(organization.id, id),
    queryFn: () => fetchMeterDetail(organization.id, id),
    retry: false,
    enabled: live && Boolean(id),
  })

  return {
    meter: live
      ? (query.data ?? null)
      : (FIXTURE_METER_DETAILS.find((meter) => meter.id === id) ?? null),
    loading: live && query.isLoading,
    error: live ? query.error : null,
  }
}
