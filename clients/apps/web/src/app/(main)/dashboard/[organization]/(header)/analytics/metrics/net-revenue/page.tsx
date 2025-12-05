import { getServerSideAPI } from '@/utils/client/serverside'
import { fromISODate, toISODate } from '@/utils/metrics'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { schemas, unwrap } from '@polar-sh/client'
import { endOfDay, max, subMonths } from 'date-fns'
import { RedirectType, redirect } from 'next/navigation'
import ClientPage from './ClientPage'

export default async function Page(props: {
  params: Promise<{ organization: string }>
  searchParams: Promise<{
    start_date?: string
    end_date?: string
    interval?: schemas['TimeInterval']
    product_id?: string | string[]
  }>
}) {
  const searchParams = await props.searchParams
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

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
    redirect(
      `/dashboard/${organization.slug}/analytics/metrics/net-revenue?${urlSearchParams}`,
      RedirectType.replace,
    )
  }

  const startDateISOString = searchParams.start_date ?? undefined
  const endDateISOString = searchParams.end_date ?? undefined

  const startDate = startDateISOString
    ? fromISODate(startDateISOString)
    : defaultStartDate
  const endDate = searchParams.end_date
    ? endOfDay(fromISODate(searchParams.end_date))
    : defaultEndDate

  const limits = await unwrap(api.GET('/v1/metrics/limits'))
  const minDate = fromISODate(limits.min_date)

  // Fetch products to determine which net revenue metrics to show
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
        (interval) =>
          daysDifference >= limits.intervals[interval].min_days &&
          daysDifference <= limits.intervals[interval].max_days,
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
    redirect(
      `/dashboard/${organization.slug}/analytics/metrics/net-revenue?${urlSearchParams}`,
      RedirectType.replace,
    )
  }

  return (
    <ClientPage
      organization={organization}
      earliestDateISOString={limits.min_date}
      startDateISOString={startDateISOString}
      endDateISOString={endDateISOString}
      interval={validInterval}
      productId={productId}
      hasRecurringProducts={hasRecurringProducts}
      hasOneTimeProducts={hasOneTimeProducts}
    />
  )
}
