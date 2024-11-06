import {
  FilterSearchParams,
  buildFundingFilters,
  urlSearchFromObj,
} from '@/components/Organization/filters'
import { getServerSideAPI } from '@/utils/api/serverside'
import { organizationPageLink } from '@/utils/nav'
import { resolveRepositoryPath } from '@/utils/repository'
import { getUserOrganizations } from '@/utils/user'
import {
  ArticleVisibility,
  ListResourceArticle,
  ListResourceIssueFunding,
  Organization,
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
      type: 'website',
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
  let posts: ListResourceArticle | undefined

  try {
    ;[issuesFunding, posts] = await Promise.all([
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

  return (
    <ClientPage
      organization={organization}
      repository={repository}
      issuesFunding={issuesFunding}
      featuredOrganizations={featuredOrganizations}
      userOrganizations={userOrganizations}
      links={links}
      posts={posts?.items ?? []}
    />
  )
}
