import { products } from '@/hooks/queries/products'
import { getServerSideAPI } from '@/utils/api/serverside'
import { redirectToCanonicalDomain } from '@/utils/nav'
import { Organization, Platforms, ResponseError } from '@polar-sh/sdk'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
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
  let organization: Organization | undefined
  const api = getServerSideAPI()

  try {
    organization = await api.organizations.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      cacheConfig,
    )
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    } else {
      throw e
    }
  }

  if (!organization) {
    notFound()
  }
  if (!organization.public_page_enabled) {
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
  params: { organization: string; productId: string }
}) {
  const api = getServerSideAPI()

  let organization: Organization | undefined

  try {
    const [loadOrganization] = await Promise.all([
      api.organizations.lookup(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
        },
        cacheConfig,
      ),
    ])

    organization = loadOrganization
  } catch (e) {
    notFound()
  }

  redirectToCanonicalDomain({
    organization,
    paramOrganizationName: params.organization,
    headers: headers(),
    subPath: `/products/${params.productId}`,
  })

  const product = products.find((p) => p.id === params.productId)

  if (!product) {
    notFound()
  }

  return <ClientPage organization={organization} product={product} />
}
