import { getServerSideAPI } from '@/utils/api'
import { Organization, Platforms } from '@polar-sh/sdk'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

export async function generateMetadata({
  params,
}: {
  params: { organization: string }
}): Promise<Metadata> {
  return {
    title: `Embeds for ${params.organization}`,
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()

  let organization: Organization | undefined

  try {
    const loadOrganization = await api.organizations.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      { cache: 'no-cache' },
    )
    organization = loadOrganization
  } catch {
    notFound()
  }

  if (!organization) {
    notFound()
  }

  return <ClientPage organization={organization} />
}
