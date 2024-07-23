import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Metadata } from 'next'
import ClientPage from './ClientPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Overview', // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  const startOfMonth = new Date()
  startOfMonth.setUTCHours(0, 0, 0, 0)
  startOfMonth.setUTCDate(1)

  const today = new Date()

  const startOfMonthThreeMonthsAgo = new Date()
  startOfMonthThreeMonthsAgo.setUTCHours(0, 0, 0, 0)
  startOfMonthThreeMonthsAgo.setUTCDate(1)
  startOfMonthThreeMonthsAgo.setUTCMonth(startOfMonth.getMonth() - 5)

  return (
    <ClientPage
      organization={organization}
      startDate={startOfMonthThreeMonthsAgo}
      endDate={today}
    />
  )
}
