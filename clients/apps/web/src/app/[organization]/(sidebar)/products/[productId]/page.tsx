import { getServerSideAPI } from '@/utils/api/serverside'
import { getOrganizationBySlugOrNotFound } from '@/utils/organization'
import { Product, ResponseError } from '@polar-sh/sdk'
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
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return {
    title: `${organization.name}`, // " | Polar is added by the template"
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
  params: { organization: string; productId: string }
}) {
  const api = getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  let product: Product | undefined
  try {
    product = await api.products.get({ id: params.productId }, cacheConfig)
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  return <ClientPage organization={organization} product={product} />
}
