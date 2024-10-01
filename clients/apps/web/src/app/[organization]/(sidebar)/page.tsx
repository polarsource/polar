import { getServerSideAPI } from '@/utils/api/serverside'
import { ListResourceIssueFunding, ListResourceProduct } from '@polar-sh/sdk'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

import { externalURL } from '@/components/Organization'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { ProfilePage as JSONLDProfilePage, WithContext } from 'schema-dts'

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
    title: `${organization.name}`, // " | Polar is added by the template"
    description: organization.bio || `${organization.name} on Polar`,
    openGraph: {
      title: `${organization.name} on Polar`,
      description: `${organization.name} on Polar`,
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
          alt: `${organization.name} on Polar`,
        },
      ],
      card: 'summary_large_image',
      title: `${organization.name} on Polar`,
      description: `${organization.name} on Polar`,
    },

    alternates: {
      types: {
        'application/rss+xml': [
          {
            title: `${organization.name}`,
            url: `https://polar.sh/${organization.slug}/rss`,
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

  let products: ListResourceProduct | undefined
  let listIssueFunding: ListResourceIssueFunding | undefined

  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  try {
    const [loadProducts, loadListIssueFunding] = await Promise.all([
      api.products.list(
        {
          organizationId: organization.id,
          isArchived: false,
        },
        {
          ...cacheConfig,
          next: {
            ...cacheConfig.next,
            tags: [`products:${organization.id}`],
          },
        },
      ),
      api.funding.search(
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
      ),
    ])

    products = loadProducts
    listIssueFunding = loadListIssueFunding
  } catch (e) {
    notFound()
  }

  // Build JSON-LD for this page
  let jsonLd: WithContext<JSONLDProfilePage> | undefined
  const sameAs = []
  if (organization.blog) {
    sameAs.push(externalURL(organization.blog))
  }
  if (organization.twitter_username) {
    sameAs.push(`https://twitter.com/${organization.twitter_username}`)
  }

  const org: WithContext<JSONLDProfilePage> = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: organization.name,
    ...(organization.avatar_url ? { image: organization.avatar_url } : {}),
    sameAs,
    mainEntity: {
      '@type': 'Organization',
      name: organization.name,
      alternateName: organization.slug,
      ...(organization.avatar_url ? { image: organization.avatar_url } : {}),
    },
  }
  jsonLd = org

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ClientPage
        organization={organization}
        products={products?.items ?? []}
        issues={listIssueFunding?.items ?? []}
      />
    </>
  )
}
