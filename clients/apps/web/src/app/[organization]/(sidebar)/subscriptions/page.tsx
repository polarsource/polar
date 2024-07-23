import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlug } from '@/utils/organization'
import { ListResourceProduct } from '@polar-sh/sdk'
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
    title: `${organization.name}`, // " | Polar is added by the template"
    openGraph: {
      title: `${organization.name} subscriptions`,
      description: `Subscribe to ${
        organization.name
      }`,
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
          alt: `${organization.name} subscriptions`,
        },
      ],
      card: 'summary_large_image',
      title: `${organization.name} subscriptions`,
      description: `Subscribe to ${
        organization.name
      }`,
    },
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const pageCache = {
    next: {
      ...cacheConfig.next,
      tags: [`organization:${params.organization}`],
    },
  }

  const api = getServerSideAPI()
  const organization = await getOrganizationBySlug(
    api,
    params.organization,
    pageCache,
  )

  if (!organization) {
    notFound()
  }

  let products: ListResourceProduct | undefined

  try {
    products = await api.products.list(
      {
        organizationId: organization.id,
        isArchived: false,
        isRecurring: true,
        limit: 100,
      },
      pageCache,
    )
  } catch (e) {
    notFound()
  }

  return (
    <ClientPage organization={organization} products={products.items || []} />
  )
}
