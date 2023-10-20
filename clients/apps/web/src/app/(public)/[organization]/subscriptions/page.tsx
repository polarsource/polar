import Header from '@/components/Organization/Header'
import PageNotFound from '@/components/Shared/PageNotFound'
import OrganizationSubscriptionsPublicPage from '@/components/Subscriptions/OrganizationSubscriptionsPublicPage'
import { getServerSideAPI } from '@/utils/api'
import {
  Organization,
  Platforms,
  ResponseError,
  SubscriptionTier,
} from '@polar-sh/sdk'
import type { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { api } from 'polarkit/api'

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
      title: `${organization.name} seeks funding for issues`,
      description: `${organization.name} seeks funding for issues on Polar`,
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
          alt: `${organization.name} seeks funding for issues`,
        },
      ],
      card: 'summary_large_image',
      title: `${organization.name} seeks funding for issues`,
      description: `${organization.name} seeks funding for issues on Polar`,
    },
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string }
}) {
  const api = getServerSideAPI()
  const organization = await api.organizations.lookup(
    {
      platform: Platforms.GITHUB,
      organizationName: params.organization,
    },
    cacheConfig,
  )

  const repositories = await api.repositories.search(
    {
      platform: Platforms.GITHUB,
      organizationName: params.organization,
    },
    cacheConfig,
  )

  let subscriptionTiers: SubscriptionTier[] = []
  try {
    const subscriptionGroupsResponse =
      await api.subscriptions.searchSubscriptionTiers(
        {
          platform: Platforms.GITHUB,
          organizationName: organization.name,
        },
        cacheConfig,
      )
    subscriptionTiers = subscriptionGroupsResponse.items ?? []
  } catch (err) {}

  if (organization === undefined || subscriptionTiers.length === 0) {
    return <PageNotFound />
  }

  return (
    <>
      <Header
        organization={organization}
        repositories={repositories.items ?? []}
      />
      <OrganizationSubscriptionsPublicPage
        organization={organization}
        subscriptionTiers={subscriptionTiers}
      />
    </>
  )
}
