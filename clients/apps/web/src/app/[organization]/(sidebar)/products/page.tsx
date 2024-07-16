import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlug } from '@/utils/organization'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

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
  const organization = await getOrganizationBySlug(
    api,
    params.organization,
    cacheConfig,
  )

  if (!organization) {
    notFound()
  }

  return {
    title: `${organization.pretty_name || organization.name}`, // " | Polar is added by the template"
    openGraph: {
      title: `${organization.pretty_name || organization.name} on Polar`,
      description: `${organization.pretty_name || organization.name} on Polar`,
      siteName: 'Polar',

      images: [
        {
          url: `https://polar.sh/og?org=${organization.name}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${organization.name}`,
          width: 1200,
          height: 630,
          alt: `${organization.pretty_name || organization.name} on Polar`,
        },
      ],
      card: 'summary_large_image',
      title: `${organization.pretty_name || organization.name} on Polar`,
      description: `${organization.pretty_name || organization.name} on Polar`,
    },

    alternates: {
      types: {
        'application/rss+xml': [
          {
            title: `${organization.pretty_name || organization.name}`,
            url: `https://polar.sh/${organization.name}/rss`,
          },
        ],
      },
    },
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlug(
    api,
    params.organization,
    cacheConfig,
  )

  if (!organization) {
    notFound()
  }

  const products = await api.products.list(
    { organizationId: organization.id, isArchived: false, isRecurring: false },
    {
      ...cacheConfig,
      next: {
        ...cacheConfig.next,
        tags: [`products:${organization.id}:one-time`],
      },
    },
  )

  return (
    <ClientPage organization={organization} products={products.items || []} />
  )
}
