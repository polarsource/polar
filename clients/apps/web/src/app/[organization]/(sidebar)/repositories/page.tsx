import { getServerSideAPI } from '@/utils/api'
import { redirectToCanonicalDomain } from '@/utils/nav'
import { Organization, Platforms, ResponseError } from '@polar-sh/sdk'
import type { Metadata, ResolvingMetadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { ClientPage } from './ClientPage'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export async function generateMetadata(
  {
    params,
  }: {
    params: { organization: string }
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
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
    }
  }

  if (!organization) {
    notFound()
  }

  return {
    title: `${organization.name}`, // " | Polar is added by the template"
    openGraph: {
      title: `${
        organization.pretty_name || organization.name
      } all repositories`,
      description: `${
        organization.pretty_name || organization.name
      } all repositories`,
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
          alt: `${
            organization.pretty_name || organization.name
          } all repositories`,
        },
      ],
      card: 'summary_large_image',
      title: `${
        organization.pretty_name || organization.name
      } all repositories`,
      description: `${
        organization.pretty_name || organization.name
      } all repositories`,
    },
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()

  const [organization, repositories] = await Promise.all([
    api.organizations.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      cacheConfig,
    ),
    api.repositories.search(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      cacheConfig,
    ),
  ])

  if (!organization) {
    notFound()
  }
  if (!organization.public_page_enabled) {
    notFound()
  }

  redirectToCanonicalDomain({
    organization,
    paramOrganizationName: params.organization,
    headers: headers(),
    subPath: '/repositories',
  })

  return (
    <ClientPage
      organization={organization}
      repositories={repositories.items ?? []}
    />
  )
}
