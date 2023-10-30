import OverviewPage from '@/components/Subscriptions/OverviewPage'
import { getServerSideAPI } from '@/utils/api'
import { Platforms } from '@polar-sh/sdk'
import { Metadata, ResolvingMetadata } from 'next'

export async function generateMetadata(
  {
    params,
  }: {
    params: { organization: string }
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  return {
    title: `${params.organization}`, // " | Polar is added by the template"
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()
  const organization = await api.organizations.lookup({
    organizationName: params.organization,
    platform: Platforms.GITHUB,
  })

  const startOfMonth = new Date()
  startOfMonth.setUTCHours(0, 0, 0, 0)
  startOfMonth.setUTCDate(1)

  const startOfMonthOneYearAgo = new Date()
  startOfMonthOneYearAgo.setUTCHours(0, 0, 0, 0)
  startOfMonthOneYearAgo.setUTCDate(1)
  startOfMonthOneYearAgo.setUTCFullYear(
    startOfMonthOneYearAgo.getUTCFullYear() - 1,
  )

  return (
    <OverviewPage
      organization={organization}
      startDate={startOfMonthOneYearAgo}
      endDate={startOfMonth}
    />
  )
}
