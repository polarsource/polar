import {
  FilterSearchParams,
  buildFundingFilters,
  urlSearchFromObj,
} from '@/components/Organization/filters'
import PageNotFound from '@/components/Shared/PageNotFound'
import { getServerSideAPI } from '@/utils/api'
import { redirectToCanonicalDomain } from '@/utils/nav'
import {
  ListResourceRepository,
  Organization,
  Platforms,
  ResponseError,
} from '@polar-sh/sdk'
import { Metadata, ResolvingMetadata } from 'next'
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

  const orgrepo = `${organization.name}/${repo.name}`

  return {
    title: `${orgrepo}`, // " | Polar is added by the template"
    description: repo.description || `${orgrepo} on Polar`,
    openGraph: {
      title: `${orgrepo} seeks funding for issues`,
      description: `${orgrepo} seeks funding for issues on Polar`,
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

  const [repository, issuesFunding] = await Promise.all([
    api.repositories.lookup(
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
  ])

  if (repository === undefined) {
    return <PageNotFound />
  }

  redirectToCanonicalDomain({
    organization: repository.organization,
    paramOrganizationName: params.organization,
    headers: headers(),
    subPath: `/${params.repo}`,
  })

  return (
    <ClientPage
      organization={repository.organization}
      repository={repository}
      issuesFunding={issuesFunding}
    />
  )
}
