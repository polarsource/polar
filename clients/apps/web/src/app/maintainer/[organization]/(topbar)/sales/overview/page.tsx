import { getServerSideAPI } from '@/utils/api/serverside'
import { Interval, MetricPeriod, Platforms } from '@polar-sh/sdk'
import { endOfMonth, startOfMonth, subMonths } from 'date-fns'
import ClientPage from './ClientPage'

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string }
  searchParams: {
    start_date?: string
    end_date?: string
    interval?: Interval
    focus?: keyof Omit<MetricPeriod, 'timestamp'>
  }
}) {
  const api = getServerSideAPI()
  const organization = await api.organizations.lookup({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })

  const today = new Date()
  const currentMonthStart = startOfMonth(today)
  const currentMonthEnd = endOfMonth(today)
  const sixMonthsAgo = subMonths(currentMonthStart, 6)

  const startDate = searchParams.start_date
    ? new Date(searchParams.start_date)
    : sixMonthsAgo
  const endDate = searchParams.end_date
    ? new Date(searchParams.end_date)
    : currentMonthEnd
  const interval = searchParams.interval || Interval.MONTH
  const focus = searchParams.focus || 'revenue'

  return (
    <ClientPage
      organization={organization}
      startDate={startDate}
      endDate={endDate}
      interval={interval}
      focus={focus}
    />
  )
}
