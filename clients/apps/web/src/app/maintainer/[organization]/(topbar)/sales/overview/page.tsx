import { getServerSideAPI } from '@/utils/api/serverside'
import { Interval, Platforms } from '@polar-sh/sdk'
import { startOfMonth } from 'date-fns'
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
  }
}) {
  const api = getServerSideAPI()
  const organization = await api.organizations.lookup({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })

  const today = new Date()
  const startDate = searchParams.start_date
    ? new Date(searchParams.start_date)
    : startOfMonth(today)
  const endDate = searchParams.end_date
    ? new Date(searchParams.end_date)
    : today
  const interval = searchParams.interval || Interval.DAY

  return (
    <ClientPage
      organization={organization}
      startDate={startDate}
      endDate={endDate}
      interval={interval}
    />
  )
}
