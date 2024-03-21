import { getServerSideAPI } from '@/utils/api'
import { redirectToCanonicalDomain } from '@/utils/nav'
import {
  ListResourceArticle,
  ListResourceIssueFunding,
  ListResourceOrganization,
  ListResourceRepository,
  ListResourceSubscriptionSummary,
  ListResourceSubscriptionTier,
  Organization,
  Platforms,
  Repository,
  ResponseError,
} from '@polar-sh/sdk'
import type { Metadata, ResolvingMetadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

import { externalURL } from '@/components/Organization'
import { Link } from '@/components/Profile/LinksEditor/LinksEditor'
import { OgObject } from 'open-graph-scraper-lite/dist/lib/types'
import { CONFIG } from 'polarkit'
import { ProfilePage as JSONLDProfilePage, WithContext } from 'schema-dts'

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
    description:
      organization.bio ||
      `${organization.pretty_name || organization.name} on Polar`,
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
  let subscriptionsSummary: ListResourceSubscriptionSummary | undefined
  let listAdminOrganizations: ListResourceOrganization | undefined
  let listIssueFunding: ListResourceIssueFunding | undefined

  try {
    const [
      loadOrganization,
      loadArticles,
      loadPinnedArticles,
      loadSubscriptionTiers,
      loadRepositories,
      loadSubscriptionsSummary,
      loadListAdminOrganizations,
      loadListIssueFunding,
    ] = await Promise.all([
      api.organizations.lookup(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
        },
        {
          ...cacheConfig,
          next: {
            ...cacheConfig.next,
            // Make it possible to revalidate the page when the organization is updated from client
            tags: [`organization:${params.organization}`],
          },
        },
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
        {
          ...cacheConfig,
          next: {
            ...cacheConfig.next,
            tags: [`subscriptionTiers:${params.organization}`],
          },
        },
      ),
      api.repositories.search(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
        },
        {
          ...cacheConfig,
          next: {
            ...cacheConfig.next,
            tags: [`repositories:${params.organization}`],
          },
        },
      ),
      api.subscriptions.searchSubscriptionsSummary(
        {
          organizationName: params.organization,
          platform: Platforms.GITHUB,
          limit: 3,
        },
        cacheConfig,
      ),
      api.organizations
        .list(
          {
            isAdminOnly: true,
          },
          cacheConfig,
        )
        .catch(() => {
          // Handle unauthenticated
          return undefined
        }),
      api.funding.search(
        {
          organizationName: params.organization,
          platform: Platforms.GITHUB,
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
            tags: [`funding:${params.organization}`],
          },
        },
      ),
    ])

    organization = loadOrganization
    articles = loadArticles
    pinnedArticles = loadPinnedArticles
    subscriptionTiers = loadSubscriptionTiers
    repositories = loadRepositories
    subscriptionsSummary = loadSubscriptionsSummary
    listAdminOrganizations = loadListAdminOrganizations
    listIssueFunding = loadListIssueFunding
  } catch (e) {
    notFound()
  }

  redirectToCanonicalDomain({
    organization,
    paramOrganizationName: params.organization,
    headers: headers(),
  })

  const sortedRepositories =
    repositories.items
      ?.filter((repo) => repo.visibility === 'public')
      .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0)) ?? []

  let featuredOrganizations: Organization[] = []
  let links: Link[] = []
  let featuredProjects: Repository[] = []

  try {
    const loadFeaturedOrganizations = await Promise.all(
      (organization.profile_settings.featured_organizations ?? []).map((id) =>
        api.organizations.get(
          { id },
          { ...cacheConfig, next: { revalidate: 60 * 60 } },
        ),
      ),
    )

    const loadFeaturedProjects = organization.profile_settings.featured_projects
      ? await Promise.all(
          organization.profile_settings.featured_projects.map((id) =>
            api.repositories.get({ id }, cacheConfig),
          ),
        )
      : sortedRepositories.slice(0, 2) ?? []

    const fallbackLinks = [
      `https://github.com/${organization.name}`,
      ...(organization.blog
        ? [
            organization.blog.startsWith('http')
              ? organization.blog
              : `https://${organization.blog}`,
          ]
        : []),
      ...(organization.twitter_username
        ? [`https://twitter.com/${organization.twitter_username}`]
        : []),
    ]

    const loadLinkOpengraphs = await Promise.all(
      (organization.profile_settings.links ?? fallbackLinks).map((link) =>
        fetch(`${CONFIG.FRONTEND_BASE_URL}/link/og?url=${link}`)
          .then((res) => (res && res.ok ? res.json() : undefined))
          .then((og) => ({ opengraph: og as OgObject, url: link })),
      ),
    )

    featuredOrganizations = loadFeaturedOrganizations
    featuredProjects = loadFeaturedProjects
    links = loadLinkOpengraphs.filter(
      (link): link is Link => link !== undefined,
    )
  } catch (err) {
    notFound()
  }

  const posts = [
    ...(pinnedArticles.items ?? []),
    ...(articles.items ?? []),
  ].slice(0, 3)

  // Build JSON-LD for this page
  let jsonLd: WithContext<JSONLDProfilePage> | undefined
  const sameAs = [`https://github.com/${organization.name}`]
  if (organization.blog) {
    sameAs.push(externalURL(organization.blog))
  }
  if (organization.twitter_username) {
    sameAs.push(`https://twitter.com/${organization.twitter_username}`)
  }

  if (organization.is_personal) {
    const person: WithContext<JSONLDProfilePage> = {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: organization.pretty_name || organization.name,
      image: organization.avatar_url,
      sameAs,
      mainEntity: {
        '@type': 'Person',
        name: organization.pretty_name || organization.name,
        alternateName: organization.name,
        image: organization.avatar_url,
      },
    }
    jsonLd = person
  } else {
    const org: WithContext<JSONLDProfilePage> = {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: organization.pretty_name || organization.name,
      image: organization.avatar_url,
      sameAs,
      mainEntity: {
        '@type': 'Organization',
        name: organization.pretty_name || organization.name,
        alternateName: organization.name,
        image: organization.avatar_url,
      },
    }
    jsonLd = org
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ClientPage
        organization={organization}
        posts={posts}
        repositories={sortedRepositories}
        featuredProjects={featuredProjects}
        featuredOrganizations={featuredOrganizations}
        subscriptionTiers={subscriptionTiers}
        subscriptionsSummary={subscriptionsSummary}
        adminOrganizations={listAdminOrganizations?.items ?? []}
        issues={listIssueFunding?.items ?? []}
        links={links}
      />
    </>
  )
}
