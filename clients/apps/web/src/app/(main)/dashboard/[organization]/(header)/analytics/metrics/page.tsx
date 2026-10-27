import ClientPage from '@/components/Metrics/dashboards/ClientPage'
import { getServerSideAPI } from '@/utils/client/serverside'
import {
  fromISODate,
  METRIC_GROUPS,
  metricGroupSlug,
  toISODate,
} from '@/utils/metrics'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { schemas, unwrap } from '@polar-sh/client'
import { endOfDay, max, subMonths } from 'date-fns'
import { redirect, RedirectType } from 'next/navigation'

const RECURRING_ONLY_GROUPS = new Set(['subscriptions', 'cancellations'])

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{
    start_date?: string
    end_date?: string
    interval?: schemas['TimeInterval']
    product_id?: string | string[]
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

  const defaultInterval = 'day'
  const today = new Date()
  const defaultStartDate = subMonths(today, 1)
  const defaultEndDate = today

  const interval = searchParams.interval || defaultInterval

  const { product_id, ...restSearchParams } = searchParams
  const productId = product_id
    ? Array.isArray(product_id)
      ? product_id
      : [product_id]
    : undefined

  if (!['year', 'month', 'week', 'day', 'hour'].includes(interval)) {
    const urlSearchParams = new URLSearchParams({
      ...restSearchParams,
      interval: defaultInterval,
    })
    productId?.forEach((id) => urlSearchParams.append('product_id', id))
    redirect(`${redirectPath}?${urlSearchParams}`, RedirectType.replace)
  }

  const startDateISOString = searchParams.start_date ?? undefined
  const endDateISOString = searchParams.end_date ?? undefined

  const startDate = startDateISOString
    ? fromISODate(startDateISOString)
    : defaultStartDate
  const endDate = endDateISOString
    ? endOfDay(fromISODate(endDateISOString))
    : defaultEndDate

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

  if (startDate < minDate || validInterval !== interval) {
    const urlSearchParams = new URLSearchParams({
      ...restSearchParams,
      start_date: toISODate(max([minDate, startDate])),
      end_date: toISODate(endDate),
      interval: validInterval,
    })
    productId?.forEach((id) => urlSearchParams.append('product_id', id))
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
