import RepositoryPublicPage from '@/components/Organization/RepositoryPublicPage'
import PageNotFound from '@/components/Shared/PageNotFound'
import Head from 'next/head'
import { api } from 'polarkit'
import { Platforms } from 'polarkit/api/client'

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
    <>
      <Head>
        <title>
          Polar | {organization.name}/{repo.name}
        </title>
        <meta
          property="og:title"
          content={`${organization.name}/${repo.name} seeks funding for issues`}
        />
        <meta
          property="og:description"
          content={`${organization.name}/${repo.name} seeks funding for issues on Polar`}
        />
        <meta name="og:site_name" content="Polar"></meta>
        <meta
          property="og:image"
          content={`https://polar.sh/og?org=${organization.name}&repo=${repo.name}`}
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <meta
          property="twitter:image"
          content={`https://polar.sh/og?org=${organization.name}&repo=${repo.name}`}
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:image:alt"
          content={`${organization.name}/${repo.name} seeks funding for issues`}
        />
        <meta
          name="twitter:title"
          content={`${organization.name}/${repo.name} seeks funding for issues`}
        />
        <meta
          name="twitter:description"
          content={`${organization.name}/${repo.name} seeks funding for issues on Polar`}
        ></meta>
      </Head>

      <RepositoryPublicPage
        organization={organization}
        repositories={repositories.items || []}
        repository={repo}
        issues={issues.items || []}
        totalIssueCount={totalIssueCount}
      />
    </>
  )
}
