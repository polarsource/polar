import {
  FilterSearchParams,
  buildFundingFilters,
  urlSearchFromObj,
} from '@/components/Organization/filters'
import { Link } from '@/components/Profile/LinksEditor/LinksEditor'
import { getServerSideAPI } from '@/utils/api/serverside'
import { CONFIG } from '@/utils/config'
import { organizationPageLink } from '@/utils/nav'
import { resolveRepositoryPath } from '@/utils/repository'
import { getUserOrganizations } from '@/utils/user'
import {
  ArticleVisibility,
  ListResourceArticle,
  ListResourceIssueFunding,
  ListResourceProduct,
  Organization,
  Product,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
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
  const api = getServerSideAPI()
  const resolvedRepositoryOrganization = await resolveRepositoryPath(
    api,
    params.organization,
    params.repo,
    cacheConfig,
  )

  if (!resolvedRepositoryOrganization) {
    notFound()
  }

  const [repository, organization] = resolvedRepositoryOrganization

  if (organization.slug !== params.organization) {
    redirect(organizationPageLink(organization, repository.name))
  }

  const orgrepo = `${organization.slug}/${repository.name}`

  return {
    title: `${orgrepo}`, // " | Polar is added by the template"
    description: repository.description || `${orgrepo} on Polar`,
    openGraph: {
      title: `${orgrepo} seeks funding for issues`,
      description: `${orgrepo} seeks funding for issues on Polar`,
      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}&repo=${repository.name}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${organization.slug}&repo=${repository.name}`,
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
  const resolvedRepositoryOrganization = await resolveRepositoryPath(
    api,
    params.organization,
    params.repo,
    {
      ...cacheConfig,
      next: {
        ...cacheConfig.next,
        // Make it possible to revalidate the page when the repository is updated from client
        tags: [`repository:${params.organization}/${params.repo}`],
      },
    },
  )

  if (!resolvedRepositoryOrganization) {
    notFound()
  }

  const [repository, organization] = resolvedRepositoryOrganization

  if (organization.slug !== params.organization) {
    redirect(organizationPageLink(organization, repository.name))
  }

  const userOrganizations = await getUserOrganizations(api)

  const filters = buildFundingFilters(urlSearchFromObj(searchParams))

  let issuesFunding: ListResourceIssueFunding | undefined
  let products: ListResourceProduct | undefined
  let posts: ListResourceArticle | undefined

  try {
    ;[issuesFunding, products, posts] = await Promise.all([
      api.funding.search(
        {
          organizationId: organization.id,
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
      api.products.list(
        {
          organizationId: organization.id,
          isArchived: false,
          isRecurring: true,
        },
        cacheConfig,
      ),
      api.articles.list(
        {
          organizationId: organization.id,
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
      organization={organization}
      repository={repository}
      issuesFunding={issuesFunding}
      featuredOrganizations={featuredOrganizations}
      products={
        (products?.items ?? []) as (Product & { type: SubscriptionTierType })[]
      }
      userOrganizations={userOrganizations}
      links={links}
      posts={posts?.items ?? []}
    />
  )
}
