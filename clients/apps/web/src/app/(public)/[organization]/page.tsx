import OrganizationPublicPage from '@/components/Organization/OrganizationPublicPage'
import PageNotFound from '@/components/Shared/PageNotFound'
import { getServerSideAPI } from '@/utils/api'
import {
  Organization,
  Platforms,
  ResponseError,
  SubscriptionSummary,
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
  searchParams,
}: {
  params: { organization: string }
  searchParams: { [key: string]: string | string[] | undefined }
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

  let subscriptionTiers: SubscriptionTier[] = []
  let subscriptionsSummary: SubscriptionSummary[] = []
  let subscribersCount = 0
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

    const subscriptionSummaryResponse =
      await api.subscriptions.searchSubscriptionsSummary(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
          limit: 20,
        },
        cacheConfig,
      )

    subscriptionsSummary = subscriptionSummaryResponse.items ?? []
    subscribersCount = subscriptionSummaryResponse.pagination.total_count
  } catch (err) {}

  if (organization === undefined || repositories === undefined) {
    return <PageNotFound />
  }

  const currentTab = searchParams.tab as string | undefined

  return (
    <>
      <OrganizationPublicPage
        organization={organization}
        repositories={repositories.items || []}
        subscriptionTiers={subscriptionTiers}
        subscriptionSummary={subscriptionsSummary}
        subscribersCount={subscribersCount}
        currentTab={currentTab}
      />
    </>
  )
}
