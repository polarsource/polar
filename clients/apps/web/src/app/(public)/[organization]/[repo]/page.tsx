import RepositoryPublicPage from '@/components/Organization/RepositoryPublicPage'
import PageNotFound from '@/components/Shared/PageNotFound'
import { Metadata, ResolvingMetadata } from 'next'
import { notFound } from 'next/navigation'
import { api } from 'polarkit'
import {
  ApiError,
  ListResource_Repository_,
  Organization,
  Platforms,
} from 'polarkit/api/client'

export async function generateMetadata(
  {
    params,
  }: {
    params: { organization: string; repo: string }
  },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  let organization: Organization | undefined
  let repositories: ListResource_Repository_ | undefined

  try {
    organization = await api.organizations.lookup({
      platform: Platforms.GITHUB,
      organizationName: params.organization,
    })

    repositories = await api.repositories.search({
      platform: Platforms.GITHUB,
      organizationName: params.organization,
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
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
}: {
  params: { organization: string; repo: string }
}) {
  const organization = await api.organizations.lookup({
    platform: Platforms.GITHUB,
    organizationName: params.organization,
  })

  const repositories = await api.repositories.search({
    platform: Platforms.GITHUB,
    organizationName: params.organization,
  })

  const issues = await api.issues.search({
    platform: Platforms.GITHUB,
    organizationName: params.organization,
    repositoryName: params.repo,
    haveBadge: true,
  })

  const totalIssueCount = issues.pagination.total_count

  if (
    organization === undefined ||
    repositories === undefined ||
    totalIssueCount === undefined
  ) {
    return <PageNotFound />
  }

  const repo = repositories.items?.find((r) => r.name === params.repo)

  if (!repo) {
    return <PageNotFound />
  }

  return (
    <RepositoryPublicPage
      organization={organization}
      repositories={repositories.items || []}
      repository={repo}
      issues={issues.items || []}
      totalIssueCount={totalIssueCount}
    />
  )
}
