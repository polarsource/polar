import {
  FilterSearchParams,
  buildFundingFilters,
  urlSearchFromObj,
} from '@/components/Organization/filters'
import { Link } from '@/components/Profile/LinksEditor/LinksEditor'
import { getServerSideAPI } from '@/utils/api/serverside'
import { CONFIG } from '@/utils/config'
import {
  ArticleVisibility,
  ListResourceArticle,
  ListResourceIssueFunding,
  ListResourceOrganization,
  ListResourceProduct,
  Organization,
  Platforms,
  Repository,
  ResponseError,
} from '@polar-sh/sdk'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { OgObject } from 'open-graph-scraper-lite/dist/lib/types'
import ClientPage from './ClientPage'

const cacheConfig = {
  next: {
    revalidate: 30, // 30 seconds
  },
}

export async function generateMetadata({
  params,
}: {
  params: { organization: string; repo: string }
}): Promise<Metadata> {
  let organization: Organization | undefined
  let repository: Repository | undefined

  const api = getServerSideAPI()

  try {
    organization = await api.organizations.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      cacheConfig,
    )
    repository = await api.repositories.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
        repositoryName: params.repo,
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

  if (!repository) {
    notFound()
  }

  const orgrepo = `${organization.name}/${repository.name}`

  return {
    title: `${orgrepo}`, // " | Polar is added by the template"
    description: repository.description || `${orgrepo} on Polar`,
    openGraph: {
      title: `${orgrepo} seeks funding for issues`,
      description: `${orgrepo} seeks funding for issues on Polar`,
      images: [
        {
          url: `https://polar.sh/og?org=${organization.name}&repo=${repository.name}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${organization.name}&repo=${repository.name}`,
          width: 1200,
          height: 630,
          alt: `${orgrepo} seeks funding for issues`,
        },
      ],
      card: 'summary_large_image',
      title: `${orgrepo} seeks funding for issues`,
      description: `${orgrepo} seeks funding for issues on Polar`,
    },
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: { organization: string; repo: string }
  searchParams: FilterSearchParams
}) {
  const api = getServerSideAPI()
  const filters = buildFundingFilters(urlSearchFromObj(searchParams))

  let repository: Repository | undefined
  let issuesFunding: ListResourceIssueFunding | undefined
  let adminOrganizations: ListResourceOrganization | undefined
  let products: ListResourceProduct | undefined
  let posts: ListResourceArticle | undefined

  try {
    repository = await api.repositories.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
        repositoryName: params.repo,
      },
      {
        ...cacheConfig,
        next: {
          ...cacheConfig.next,
          // Make it possible to revalidate the page when the repository is updated from client
          tags: [`repository:${params.organization}/${params.repo}`],
        },
      },
    )
    ;[issuesFunding, adminOrganizations, products, posts] = await Promise.all([
      api.funding.search(
        {
          platform: Platforms.GITHUB,
          organizationName: params.organization,
          repositoryName: params.repo,
          query: filters.q,
          sorting: filters.sort,
          badged: filters.badged,
          limit: 20,
          closed: filters.closed,
          page: searchParams.page ? parseInt(searchParams.page) : 1,
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
      api.products.list(
        {
          organizationId: repository.organization.id,
          isRecurring: true,
        },
        cacheConfig,
      ),
      api.articles.list(
        {
          organizationId: repository.organization.id,
          isPublished: true,
          visibility: ArticleVisibility.PUBLIC,
          limit: 3,
        },
        cacheConfig,
      ),
    ])
  } catch (e) {
    notFound()
  }

  if (!repository.organization.public_page_enabled) {
    notFound()
  }

  let featuredOrganizations: Organization[] = []
  let links: { opengraph: OgObject; url: string }[] = []

  try {
    const featuredOrganizationIDs =
      repository.profile_settings?.featured_organizations ?? []

    const loadFeaturedOrganizations = await Promise.all(
      featuredOrganizationIDs.map((id) =>
        api.organizations.get({ id }, cacheConfig),
      ),
    )

    const featuredLinks = repository.profile_settings?.links ?? []

    const loadLinkOpengraphs = await Promise.all(
      featuredLinks.map((link) =>
        fetch(`${CONFIG.FRONTEND_BASE_URL}/link/og?url=${link}`)
          .then((res) => (res && res.ok ? res.json() : undefined))
          .then((og) => ({ opengraph: og as OgObject, url: link })),
      ),
    )

    featuredOrganizations = loadFeaturedOrganizations
    links = loadLinkOpengraphs.filter(
      (link): link is Link => link !== undefined,
    )
  } catch (err) {
    notFound()
  }

  return (
    <ClientPage
      organization={repository.organization}
      repository={repository}
      issuesFunding={issuesFunding}
      featuredOrganizations={featuredOrganizations}
      products={products?.items ?? []}
      adminOrganizations={adminOrganizations?.items ?? []}
      links={links}
      posts={posts?.items ?? []}
    />
  )
}
