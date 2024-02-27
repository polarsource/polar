import { getServerSideAPI } from '@/utils/api'
import { redirectToCustomDomain } from '@/utils/nav'
import {
  ListResourceArticle,
  ListResourceRepository,
  ListResourceSubscriptionTier,
  Organization,
  Platforms,
  ResponseError,
} from '@polar-sh/sdk'
import type { Metadata, ResolvingMetadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

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
    } else {
      throw e
    }
  }

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

  let organization: Organization | undefined
  let pinnedArticles: ListResourceArticle | undefined
  let articles: ListResourceArticle | undefined
  let subscriptionTiers: ListResourceSubscriptionTier | undefined
  let repositories: ListResourceRepository | undefined

  try {
    const [
      loadOrganization,
      loadArticles,
      loadPinnedArticles,
      loadSubscriptionTiers,
      loadRepositories,
    ] = await Promise.all([
      api.organizations.lookup(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
        },
        cacheConfig,
      ),
      api.articles.search(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
          isPinned: false,
          limit: 3,
        },
        cacheConfig,
      ),
      api.articles.search(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
          isPinned: true,
          limit: 3,
        },
        cacheConfig,
      ),
      api.subscriptions.searchSubscriptionTiers(
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

    organization = loadOrganization
    articles = loadArticles
    pinnedArticles = loadPinnedArticles
    subscriptionTiers = loadSubscriptionTiers
    repositories = loadRepositories
  } catch (e) {
    notFound()
  }

  redirectToCustomDomain(organization, headers())

  const posts = [
    ...(pinnedArticles.items ?? []),
    ...(articles.items ?? []),
  ].slice(0, 3)

  const sortedRepositories =
    repositories.items
      ?.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
      .slice(0, 4) ?? []

  return (
    <ClientPage
      organization={organization}
      posts={posts}
      repositories={sortedRepositories}
      subscriptionTiers={subscriptionTiers}
    />
  )
}
