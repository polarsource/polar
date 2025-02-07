import { getServerSideAPI as getNewServerSideAPI } from '@/utils/client/serverside'
import { ListResourceIssueFunding } from '@polar-sh/api'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

import { getServerSideAPI } from '@/utils/api/serverside'
import { getStorefrontOrNotFound } from '@/utils/storefront'

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
  const api = getNewServerSideAPI()
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
  const newAPI = getNewServerSideAPI()

  let listIssueFunding: ListResourceIssueFunding | undefined

  const { organization, products } = await getStorefrontOrNotFound(
    newAPI,
    params.organization,
  )

  try {
    const api = getServerSideAPI()
    const loadListIssueFunding = await api.funding.search(
      {
        organizationId: organization.id,
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
      {
        ...cacheConfig,
        next: {
          ...cacheConfig.next,
          tags: [`funding:${organization.id}`],
        },
      },
    )
    listIssueFunding = loadListIssueFunding
  } catch (e) {
    notFound()
  }

  return (
    <ClientPage
      organization={organization}
      products={products}
      issues={listIssueFunding?.items ?? []}
    />
  )
}
