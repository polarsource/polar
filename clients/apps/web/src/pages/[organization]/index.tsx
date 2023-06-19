import EmptyLayout from '@/components/Layout/EmptyLayout'
import OrganizationPublicPage from '@/components/Organization/OrganizationPublicPage'
import RepoSelection from '@/components/Organization/RepoSelection'
import PageNotFound from '@/components/Shared/PageNotFound'
import type { GetServerSideProps, NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { api } from 'polarkit'
import {
  IssuePublicRead,
  OrganizationPublicRead,
  Platforms,
  RepositoryPublicRead,
} from 'polarkit/api/client'
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

  return (
    <>
      <Head>
        <title>Polar | {organization.name}</title>
      </Head>
      <div className="mx-auto mt-12 flex w-full flex-col space-y-12 px-2 md:max-w-[970px] md:px-0">
        <div className="flex items-center space-x-4 text-black">
          <img src={organization.avatar_url} className="h-8 w-8 rounded-full" />
          <div className="text-lg font-medium">{organization.name}</div>
          <div>/</div>
          <RepoSelection
            organization={organization}
            repositories={repositories}
            value={undefined}
            onSelectRepo={(org, repo) => {
              router.push(`/${org}/${repo}`)
            }}
          />
        </div>

        <OrganizationPublicPage
          organization={organization}
          repositories={repositories}
          issues={issues}
        />
      </div>
    </>
  )
}

Page.getLayout = (page: ReactElement) => {
  return <EmptyLayout>{page}</EmptyLayout>
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
    const { organization, repositories, issues } = res
    return { props: { organization, repositories, issues } }
  } catch (Error) {
    return { props: {} }
  }
}

export default Page
