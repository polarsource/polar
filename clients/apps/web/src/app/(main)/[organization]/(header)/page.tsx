import { getServerSideAPI } from '@/utils/client/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'
import { unwrap } from '@polar-sh/client'
import type { Metadata } from 'next'
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
  const { organization } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )

  return {
    title: `${organization.name}`, // " | Polar is added by the template"
    description: organization.bio || `${organization.name} on Polar`,
    openGraph: {
      title: `${organization.name} on Polar`,
      description: `${organization.name} on Polar`,
      siteName: 'Polar',
      type: 'website',
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
          alt: `${organization.name} on Polar`,
        },
      ],
      card: 'summary_large_image',
      title: `${organization.name} on Polar`,
      description: `${organization.name} on Polar`,
    },
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()
  const { organization, products } = await getStorefrontOrNotFound(
    api,
    params.organization,
  )
  const listIssueFunding = await unwrap(
    api.GET('/v1/funding/search', {
      params: {
        query: {
          organization_id: organization.id,
          limit: 10,
          page: 1,
          closed: false,
          sorting: [
            'most_funded',
            'most_recently_funded',
            'most_engagement',
            'newest',
          ],
        },
      },
      ...cacheConfig,
    }),
  )

  return (
    <ClientPage
      organization={organization}
      products={products}
      issues={listIssueFunding?.items ?? []}
    />
  )
}
