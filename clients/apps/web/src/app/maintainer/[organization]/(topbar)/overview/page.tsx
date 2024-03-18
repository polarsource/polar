import { getServerSideAPI } from '@/utils/api'
import { Platforms } from '@polar-sh/sdk'
import { Metadata, ResolvingMetadata } from 'next'
import ClientPage from './ClientPage'

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
