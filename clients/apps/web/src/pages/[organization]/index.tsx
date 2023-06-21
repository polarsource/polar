import PublicLayout from '@/components/Layout/PublicLayout'
import Navigation from '@/components/Organization/Navigation'
import OrganizationPublicPage from '@/components/Organization/OrganizationPublicPage'
import PageNotFound from '@/components/Shared/PageNotFound'
import type { GetServerSideProps, NextLayoutComponentType } from 'next'
import Head from 'next/head'
import Link from 'next/link'
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
  if (
    organization === undefined ||
    repositories === undefined ||
    totalIssueCount === undefined
  ) {
    return <PageNotFound />
  }

  return (
    <>
      <Head>
        <title>Polar | {organization.name}</title>
        <meta
          property="og:title"
          content={`${organization.name} seeks funding for issues`}
        />
        <meta
          property="og:description"
          content={`${organization.name} seeks funding for issues on Polar`}
        />
        <meta
          property="og:image"
          content={`/api/og/render.svg?org=${organization.name}`}
        />
      </Head>

      <div className="flex items-center justify-between">
        <Navigation
          organization={organization}
          repositories={repositories}
          repository={undefined}
        ></Navigation>

        <Link href="/">
          <LogoType />
        </Link>
      </div>

      <OrganizationPublicPage
        organization={organization}
        repositories={repositories}
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
    if (typeof context?.params?.organization !== 'string') {
      return { props: {} }
    }

    const res = await api.organizations.getPublicIssues({
      platform: Platforms.GITHUB,
      orgName: context.params.organization,
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
