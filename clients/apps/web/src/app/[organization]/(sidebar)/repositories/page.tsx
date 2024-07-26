import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import type { Metadata } from 'next'
import { ClientPage } from './ClientPage'

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
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return {
    title: `${organization.slug}`, // " | Polar is added by the template"
    openGraph: {
      title: `${organization.name} all repositories`,
      description: `${organization.name} all repositories`,
      siteName: 'Polar',

      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}`,
          width: 1200,
          height: 630,
          alt: `${organization.name} all repositories`,
        },
      ],
      card: 'summary_large_image',
      title: `${organization.name} all repositories`,
      description: `${organization.name} all repositories`,
    },
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

  const repositories = await api.repositories.list(
    {
      organizationId: organization.id,
    },
    cacheConfig,
  )

  return (
    <ClientPage
      organization={organization}
      repositories={repositories.items ?? []}
    />
  )
}
