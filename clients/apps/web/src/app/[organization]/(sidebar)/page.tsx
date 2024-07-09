import { getServerSideAPI } from '@/utils/api/serverside'
import {
  ArticleVisibility,
  ListResourceArticle,
  ListResourceIssueFunding,
  ListResourceOrganization,
  ListResourceProduct,
  ListResourcePublicDonation,
  ListResourceRepository,
  Organization,
  Platforms,
  Repository,
  ResponseError,
} from '@polar-sh/sdk'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

import { externalURL } from '@/components/Organization'
import { Link } from '@/components/Profile/LinksEditor/LinksEditor'
import { CONFIG } from '@/utils/config'
import { OgObject } from 'open-graph-scraper-lite/dist/lib/types'
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
  let products: ListResourceProduct | undefined
  let repositories: ListResourceRepository | undefined
  let listAdminOrganizations: ListResourceOrganization | undefined
  let listIssueFunding: ListResourceIssueFunding | undefined
  let donations: ListResourcePublicDonation | undefined

  try {
    organization = await api.organizations.lookup(
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
    )

    const [
      loadArticles,
      loadPinnedArticles,
      loadProducts,
      loadRepositories,
      loadListAdminOrganizations,
      loadListIssueFunding,
      loadDonations,
    ] = await Promise.all([
      api.articles.list(
        {
          organizationId: organization.id,
          isPublished: true,
          visibility: ArticleVisibility.PUBLIC,
          isPinned: false,
          limit: 3,
        },
        {
          ...cacheConfig,
          next: {
            ...cacheConfig.next,
            tags: [`articles:${organization.id}`],
          },
        },
      ),
      api.articles.list(
        {
          organizationId: organization.id,
          isPublished: true,
          visibility: ArticleVisibility.PUBLIC,
          isPinned: true,
          limit: 3,
        },
        {
          ...cacheConfig,
          next: {
            ...cacheConfig.next,
            tags: [`articles:${organization.id}`],
          },
        },
      ),
      api.products.list(
        {
          organizationId: organization.id,
          isArchived: false,
          isRecurring: true,
        },
        {
          ...cacheConfig,
          next: {
            ...cacheConfig.next,
            tags: [`products:${organization.id}:recurring`],
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
      api.donations.donationsPublicSearch(
        {
          organizationName: params.organization,
          platform: Platforms.GITHUB,
          limit: 5,
        },
        {
          ...cacheConfig,
          next: {
            ...cacheConfig.next,
            tags: [`donations:${params.organization}`],
          },
        },
      ),
    ])

    articles = loadArticles
    pinnedArticles = loadPinnedArticles
    products = loadProducts
    repositories = loadRepositories
    listAdminOrganizations = loadListAdminOrganizations
    listIssueFunding = loadListIssueFunding
    donations = loadDonations
  } catch (e) {
    notFound()
  }

  if (!organization.public_page_enabled) {
    notFound()
  }

  const sortedRepositories =
    repositories.items
      ?.filter((repo) => repo.visibility === 'public')
      .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0)) ?? []

  let featuredOrganizations: Organization[] = []
  let links: Link[] = []
  let featuredProjects: Repository[] = []

  try {
    const featuredOrganizationIDs =
      organization.profile_settings?.featured_organizations ?? []

    const loadFeaturedOrganizations = await Promise.all(
      featuredOrganizationIDs.map((id) =>
        api.organizations.get(
          { id },
          { ...cacheConfig, next: { revalidate: 60 * 60 } },
        ),
      ),
    )

    const featuredProjectIDs =
      organization.profile_settings?.featured_projects ?? []

    const loadFeaturedProjects =
      featuredProjectIDs.length > 0
        ? await Promise.all(
            featuredProjectIDs.map((id) =>
              api.repositories
                .get({ id }, cacheConfig)
                .catch((err) => console.error(err)),
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

    const featuredLinks = organization.profile_settings?.links ?? fallbackLinks

    const loadLinkOpengraphs = await Promise.all(
      featuredLinks.map((link) =>
        fetch(`${CONFIG.FRONTEND_BASE_URL}/link/og?url=${link}`)
          .then((res) => (res && res.ok ? res.json() : undefined))
          .then((og) => ({ opengraph: og as OgObject, url: link })),
      ),
    )

    featuredOrganizations = loadFeaturedOrganizations

    featuredProjects = loadFeaturedProjects.filter((repo): repo is Repository =>
      Boolean(repo),
    )

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
        products={products?.items ?? []}
        adminOrganizations={listAdminOrganizations?.items ?? []}
        issues={listIssueFunding?.items ?? []}
        links={links}
        donations={donations?.items ?? []}
      />
    </>
  )
}
