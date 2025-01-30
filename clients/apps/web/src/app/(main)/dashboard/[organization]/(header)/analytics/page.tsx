import { getServerSideAPI } from '@/utils/api/serverside'
import { fromISODate, toISODate } from '@/utils/metrics'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { TimeInterval } from '@polar-sh/api'
import {
  addDays,
  endOfMonth,
  max,
  min,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { RedirectType, redirect } from 'next/navigation'
import ClientPage from './ClientPage'

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: {
    start_date?: string
    end_date?: string
    interval?: TimeInterval
    product_id?: string | string[]
  }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const defaultInterval = TimeInterval.MONTH
  const today = new Date()
  const defaultStartDate = subMonths(startOfMonth(today), 3)
  const defaultEndDate = endOfMonth(today)

  const interval = searchParams.interval || defaultInterval

  const { product_id, ...restSearchParams } = searchParams
  const productId = product_id
    ? Array.isArray(product_id)
      ? product_id
      : [product_id]
    : undefined

  if (!Object.values(TimeInterval).includes(interval)) {
    const urlSearchParams = new URLSearchParams({
      ...restSearchParams,
      interval: defaultInterval,
    })
    productId?.forEach((id) => urlSearchParams.append('product_id', id))
    redirect(
      `/dashboard/${organization.slug}/analytics?${urlSearchParams}`,
      RedirectType.replace,
    )
  }

  const startDate = searchParams.start_date
    ? fromISODate(searchParams.start_date)
    : defaultStartDate
  const endDate = searchParams.end_date
    ? fromISODate(searchParams.end_date)
    : defaultEndDate

  const limits = await api.metrics.limits()
  const minDate = fromISODate(limits.min_date)
  const maxDate = addDays(startDate, limits.intervals[interval].max_days - 1)

  if (startDate < minDate || endDate > maxDate) {
    const urlSearchParams = new URLSearchParams({
      ...restSearchParams,
      start_date: toISODate(max([minDate, startDate])),
      end_date: toISODate(min([endDate, maxDate])),
    })
    productId?.forEach((id) => urlSearchParams.append('product_id', id))
    redirect(
      `/dashboard/${organization.slug}/analytics?${urlSearchParams}`,
      RedirectType.replace,
    )
  }

  return (
    <ClientPage
      organization={organization}
      limits={limits}
      startDate={startDate}
      endDate={endDate}
      interval={interval}
      productId={productId}
    />
  )
}
