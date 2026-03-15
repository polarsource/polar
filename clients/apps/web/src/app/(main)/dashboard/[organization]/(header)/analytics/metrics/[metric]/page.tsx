import ClientPage from '@/components/metrics/dashboards/ClientPage'
import CustomMetricsPage from '@/components/metrics/dashboards/CustomMetricsPage'
import DashboardDetailClientPage from '@/components/metrics/dashboards/DashboardDetailClientPage'
import {
  isValidMetricType,
  MetricType,
} from '@/components/metrics/dashboards/metrics-config'
import { getServerSideAPI } from '@/utils/client/serverside'
import { fromISODate, toISODate } from '@/utils/metrics'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { schemas, unwrap } from '@polar-sh/client'
import { endOfDay, max, subMonths } from 'date-fns'
import { notFound, redirect, RedirectType } from 'next/navigation'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Page(props: {
  params: Promise<{ organization: string; metric: string }>
  searchParams: Promise<{
    start_date?: string
    end_date?: string
    interval?: schemas['TimeInterval']
    product_id?: string | string[]
  }>
}) {
  const { organization: organizationSlug, metric } = await props.params
  const searchParams = await props.searchParams

  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    organizationSlug,
  )

  // Handle custom user-created dashboards (UUID slugs)
  if (UUID_REGEX.test(metric)) {
    const result = await api.GET('/v1/metrics/dashboards/{id}', {
      params: { path: { id: metric } },
    })
    if (result.error || !result.data) {
      notFound()
    }
    return (
      <DashboardDetailClientPage
        organization={organization}
        dashboard={result.data}
      />
    )
  }

  if (!isValidMetricType(metric)) {
    notFound()
  }

  if (metric === 'custom') {
    return <CustomMetricsPage organization={organization} />
  }

  const redirectPath = `/dashboard/${organizationSlug}/analytics/metrics/${metric}`

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

  const limits = await unwrap(api.GET('/v1/metrics/limits'))
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

  const products = await unwrap(
    api.GET('/v1/products/', {
      params: {
        query: {
          organization_id: organization.id,
          limit: 100,
          is_archived: false,
        },
      },
    }),
  )

  const relevantProducts = productId
    ? products.items.filter((p) => productId.includes(p.id))
    : products.items

  const hasRecurringProducts = relevantProducts.some((p) => p.is_recurring)
  const hasOneTimeProducts = relevantProducts.some((p) => !p.is_recurring)

  return (
    <ClientPage
      metric={metric as MetricType}
      organizationId={organization.id}
      hasRecurringProducts={hasRecurringProducts}
      hasOneTimeProducts={hasOneTimeProducts}
    />
  )
}
