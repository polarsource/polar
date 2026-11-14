import ClientPage from '@/components/Metrics/dashboards/ClientPage'
import { getServerSideAPI } from '@/utils/client/serverside'
import {
  fromISODate,
  METRIC_GROUPS,
  metricGroupSlug,
  parseAsISODate,
  TIME_INTERVALS,
  toISODate,
} from '@/utils/metrics'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { schemas, unwrap } from '@polar-sh/client'
import { endOfDay, max, subMonths } from 'date-fns'
import { redirect, RedirectType } from 'next/navigation'
import { createLoader, parseAsStringLiteral } from 'nuqs/server'

const RECURRING_ONLY_GROUPS = new Set(['subscriptions', 'cancellations'])

const loadMetricsSearchParams = createLoader({
  start_date: parseAsISODate,
  end_date: parseAsISODate,
  interval: parseAsStringLiteral(TIME_INTERVALS),
})

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{
    start_date?: string
    end_date?: string
    interval?: string
    product_id?: string | string[]
    external_product_id?: string | string[]
  }>
}) {
  const { organization: organizationSlug } = await props.params
  const searchParams = await props.searchParams

  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    organizationSlug,
  )

  const redirectPath = `/dashboard/${organizationSlug}/analytics/metrics`

  const today = new Date()
  const defaultStartDate = subMonths(today, 1)
  const defaultEndDate = today

  const urlSearchParams = new URLSearchParams(
    Object.entries(searchParams).flatMap(([key, value]) =>
      [value ?? []].flat().map((v) => [key, v]),
    ),
  )

  const parsedSearchParams = loadMetricsSearchParams(searchParams)

  const interval = parsedSearchParams.interval ?? 'day'
  const requestedStartDate = parsedSearchParams.start_date ?? defaultStartDate
  const requestedEndDate = parsedSearchParams.end_date
    ? endOfDay(parsedSearchParams.end_date)
    : defaultEndDate
  const hasInvalidDateRange =
    (searchParams.start_date !== undefined &&
      parsedSearchParams.start_date === null) ||
    (searchParams.end_date !== undefined &&
      parsedSearchParams.end_date === null) ||
    requestedStartDate > requestedEndDate
  const startDate = hasInvalidDateRange ? defaultStartDate : requestedStartDate
  const endDate = hasInvalidDateRange ? defaultEndDate : requestedEndDate

  const [limits, recurringProducts] = await Promise.all([
    unwrap(api.GET('/v1/metrics/limits')),
    unwrap(
      api.GET('/v1/products/', {
        params: {
          query: {
            organization_id: organization.id,
            is_recurring: true,
            limit: 1,
            is_archived: null,
          },
        },
      }),
    ),
  ])
  const minDate = fromISODate(limits.min_date)

  const findValidInterval = (
    start: Date,
    end: Date,
    currentInterval: schemas['TimeInterval'],
  ): schemas['TimeInterval'] => {
    const daysDifference = Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    )
    if (
      daysDifference >= limits.intervals[currentInterval].min_days &&
      daysDifference <= limits.intervals[currentInterval].max_days
    ) {
      return currentInterval
    }

    const intervals: schemas['TimeInterval'][] = [
      'year',
      'month',
      'week',
      'day',
      'hour',
    ]

    if (daysDifference > limits.intervals[currentInterval].max_days) {
      intervals.reverse()
    }

    return (
      intervals.find(
        (i) =>
          daysDifference >= limits.intervals[i].min_days &&
          daysDifference <= limits.intervals[i].max_days,
      ) || 'day'
    )
  }

  const validInterval = findValidInterval(startDate, endDate, interval)

  const hasInvalidInterval =
    searchParams.interval !== undefined && parsedSearchParams.interval === null

  if (
    hasInvalidDateRange ||
    hasInvalidInterval ||
    startDate < minDate ||
    validInterval !== interval
  ) {
    urlSearchParams.set('start_date', toISODate(max([minDate, startDate])))
    urlSearchParams.set('end_date', toISODate(endDate))
    urlSearchParams.set('interval', validInterval)
    redirect(`${redirectPath}?${urlSearchParams}`, RedirectType.replace)
  }

  const hasRecurringProducts = recurringProducts.pagination.total_count > 0
  const groupSlugs = METRIC_GROUPS.map((g) =>
    metricGroupSlug(g.category),
  ).filter((slug) => hasRecurringProducts || !RECURRING_ONLY_GROUPS.has(slug))

  return (
    <ClientPage
      organization={organization}
      groupSlugs={groupSlugs}
      earliestDateISOString={limits.min_date}
    />
  )
}
