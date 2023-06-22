import PublicLayout from '@/components/Layout/PublicLayout'
import Navigation from '@/components/Organization/Navigation'
import RepositoryPublicPage from '@/components/Organization/RepositoryPublicPage'
import PageNotFound from '@/components/Shared/PageNotFound'
import type { GetServerSideProps, NextLayoutComponentType } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { api } from 'polarkit'
import {
  IssuePublicRead,
  OrganizationPublicRead,
  Platforms,
  RepositoryPublicRead,
} from 'polarkit/api/client'
import { LogoType } from 'polarkit/components/brand'
import { ReactElement } from 'react'

const Page: NextLayoutComponentType = ({
  organization,
  repositories,
  issues,
  totalIssueCount,
}: {
  organization?: OrganizationPublicRead
  repositories?: RepositoryPublicRead[]
  issues?: IssuePublicRead[]
  totalIssueCount?: number
}) => {
  const router = useRouter()

  if (
    organization === undefined ||
    repositories === undefined ||
    totalIssueCount === undefined
  ) {
    return <PageNotFound />
  }

  const repoName = router.query.repo
  const repo = repositories.find((r) => r.name === repoName)

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
        <meta property="og:image" content={`/og?org=${organization.name}`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
      </Head>

      <div className="flex items-center justify-between">
        <Navigation
          organization={organization}
          repositories={repositories}
          repository={repo}
        ></Navigation>

        <Link href="/">
          <LogoType />
        </Link>
      </div>

      <RepositoryPublicPage
        organization={organization}
        repository={repo}
        issues={issues}
        totalIssueCount={totalIssueCount}
      />
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <PublicLayout>{page}</PublicLayout>
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    if (
      typeof context?.params?.organization !== 'string' ||
      typeof context?.params?.repo !== 'string'
    ) {
      return { props: {} }
    }

    const res = await api.organizations.getPublicIssues({
      platform: Platforms.GITHUB,
      orgName: context.params.organization,
      repoName: context.params.repo,
    })
    const {
      organization,
      repositories,
      issues,
      total_issue_count: totalIssueCount,
    } = res
    return { props: { organization, repositories, issues, totalIssueCount } }
  } catch (Error) {
    return { props: {} }
  }
}

export default Page
