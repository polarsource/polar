import PublicLayout from '@/components/Layout/PublicLayout'
import OrganizationPublicPage from '@/components/Organization/OrganizationPublicPage'
import PageNotFound from '@/components/Shared/PageNotFound'
import type { GetServerSideProps, NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { api } from 'polarkit'
import {
  IssuePublicRead,
  Organization,
  Platforms,
  RepositoryPublicRead,
} from 'polarkit/api/client'
import { ReactElement } from 'react'

const Page: NextLayoutComponentType = ({
  organization,
  repositories,
  issues,
  totalIssueCount,
}: {
  organization?: Organization
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
        <meta name="og:site_name" content="Polar"></meta>
        <meta
          property="og:image"
          content={`https://polar.sh/og?org=${organization.name}`}
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <meta
          property="twitter:image"
          content={`https://polar.sh/og?org=${organization.name}`}
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:image:alt"
          content={`${organization.name} seeks funding for issues`}
        />
        <meta
          name="twitter:title"
          content={`${organization.name} seeks funding for issues`}
        />
        <meta
          name="twitter:description"
          content={`${organization.name} seeks funding for issues on Polar`}
        ></meta>
      </Head>

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
