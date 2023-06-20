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
}: {
  organization?: OrganizationPublicRead
  repositories?: RepositoryPublicRead[]
  issues?: IssuePublicRead[]
}) => {
  const router = useRouter()

  if (!organization) {
    return <PageNotFound />
  }
  if (!repositories) {
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
    const { organization, repositories, issues } = res
    return { props: { organization, repositories, issues } }
  } catch (Error) {
    return { props: {} }
  }
}

export default Page
