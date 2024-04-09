import Rewarded from '@/components/Finance/IssueFunding/Rewarded'
import { getServerSideAPI } from '@/utils/api'
import { Platforms } from '@polar-sh/sdk'
import { Metadata } from 'next'
import { RedirectType, redirect } from 'next/navigation'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export async function generateMetadata({
  params,
}: {
  params: { organization: string }
}): Promise<Metadata> {
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
  const organization = await api.organizations.lookup(
    {
      platform: Platforms.GITHUB,
      organizationName: params.organization,
    },
    cacheConfig,
  )
  if (organization.is_personal) {
    redirect('/finance/rewards', RedirectType.replace)
  }

  return <Rewarded organization={organization} />
}
