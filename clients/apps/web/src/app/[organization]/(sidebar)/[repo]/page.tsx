import {
  FilterSearchParams,
  buildFundingFilters,
  urlSearchFromObj,
} from '@/components/Organization/filters'
import PageNotFound from '@/components/Shared/PageNotFound'
import { getServerSideAPI } from '@/utils/api'
import {
  ListResourceRepository,
  Organization,
  Platforms,
  ResponseError,
} from '@polar-sh/sdk'
import { Metadata, ResolvingMetadata } from 'next'
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
    params: { organization: string; repo: string }
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  let organization: Organization | undefined
  let repositories: ListResourceRepository | undefined

  const api = getServerSideAPI()

  try {
    organization = await api.organizations.lookup(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
      },
      cacheConfig,
    )

    repositories = await api.repositories.search(
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

  if (!organization || !repositories) {
    notFound()
  }

  const repo = repositories.items?.find((r) => r.name === params.repo)

  if (!repo) {
    notFound()
  }

  return {
    title: `${organization.name}/${repo.name}`, // " | Polar is added by the template"
    openGraph: {
      title: `${organization.name}/${repo.name} seeks funding for issues`,
      description: `${organization.name}/${repo.name} seeks funding for issues on Polar`,
      images: [
        {
          url: `https://polar.sh/og?org=${organization.name}&repo=${repo.name}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${organization.name}&repo=${repo.name}`,
          width: 1200,
          height: 630,
          alt: `${organization.name}/${repo.name} seeks funding for issues`,
        },
      ],
      card: 'summary_large_image',
      title: `${organization.name}/${repo.name} seeks funding for issues`,
      description: `${organization.name}/${repo.name} seeks funding for issues on Polar`,
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

  const [repositories, issuesFunding, noFilterSearch] = await Promise.all([
    api.repositories.search(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
        repositoryName: params.repo,
      },
      cacheConfig,
    ),
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
    api.funding.search(
      {
        platform: Platforms.GITHUB,
        organizationName: params.organization,
        repositoryName: params.repo,
        limit: 20,
      },
      cacheConfig,
    ),
  ])

  if (repositories === undefined) {
    return <PageNotFound />
  }

  const repo = repositories.items?.find((r) => r.name === params.repo)

  if (!repo) {
    return <PageNotFound />
  }

  return (
    <ClientPage
      organization={repo.organization}
      repository={repo}
      issuesFunding={issuesFunding}
      totalIssueCount={noFilterSearch.pagination.total_count}
    />
  )
}
