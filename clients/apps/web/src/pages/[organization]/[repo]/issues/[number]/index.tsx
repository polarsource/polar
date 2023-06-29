import PublicLayout from '@/components/Layout/PublicLayout'
import TopbarLayout from '@/components/Layout/TopbarLayout'
import Pledge from '@/components/Pledge'
import HowItWorks from '@/components/Pledge/HowItWorks'
import PageNotFound from '@/components/Shared/PageNotFound'
import type { GetServerSideProps, NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { api } from 'polarkit'
import {
  IssueRead,
  OrganizationPublicRead,
  Platforms,
  RepositoryRead,
} from 'polarkit/api/client'
import { posthog } from 'posthog-js'
import { ReactElement, useEffect } from 'react'

type Params = {
  issue?: IssueRead
  organization?: OrganizationPublicRead
  repository?: RepositoryRead
  query?: {
    as_org?: string
    goto_url?: string
  }
}

const PledgePage: NextLayoutComponentType = ({
  organization,
  repository,
  issue,
  query,
}: Params) => {
  useEffect(() => {
    if (organization && repository && issue) {
      posthog.capture('Pledge page shown', {
        'Organization ID': organization.id,
        'Organization Name': organization.name,
        'Repository ID': repository.id,
        'Repository Name': repository.name,
        'Issue ID': issue.id,
        'Issue Number': issue.number,
      })
    }
  }, [organization, repository, issue])

  if (!issue) {
    return <PageNotFound />
  }
  if (!organization || !repository) {
    return <></>
  }

  return (
    <>
      <Head>
        <title>Polar | {issue.title}</title>
        <meta property="og:title" content={`Back ${issue.title}`} />
        <meta
          property="og:description"
          content={`${organization.name} seeks funding for ${issue.title} Polar`}
        />
        <meta name="og:site_name" content="Polar"></meta>
        <meta
          property="og:image"
          content={`https://polar.sh/og?org=${organization.name}&repo=${repository.name}&number=${issue.number}`}
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <meta
          property="twitter:image"
          content={`https://polar.sh/og?org=${organization.name}&repo=${repository.name}&number=${issue.number}`}
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:image:alt"
          content={`${organization.name} seeks funding for ${issue.title} Polar`}
        />
        <meta name="twitter:title" content={`Back ${issue.title}`} />
        <meta
          name="twitter:description"
          content={`${organization.name} seeks funding for ${issue.title} Polar`}
        ></meta>
      </Head>

      <h1 className="text-center text-3xl font-normal text-gray-800 dark:text-gray-300 md:text-4xl">
        Complete your backing
      </h1>

      <Pledge
        organization={organization}
        repository={repository}
        issue={issue}
        asOrg={query?.as_org}
        gotoURL={query?.goto_url}
      />

      <HowItWorks />

      <div className="flex items-center justify-center gap-6">
        <a className="text-blue-600 hover:text-blue-500" href="/faq">
          Polar FAQ
        </a>
        <span className="text-gray-500">&copy; Polar Software Inc 2023</span>
      </div>
    </>
  )
}

PledgePage.getLayout = (page: ReactElement) => {
  return (
    <TopbarLayout>
      <PublicLayout>{page}</PublicLayout>
    </TopbarLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    if (
      typeof context?.params?.organization !== 'string' ||
      typeof context?.params?.repo !== 'string' ||
      typeof context?.params?.number !== 'string'
    ) {
      return { props: {} }
    }

    const res = await api.pledges.getPledgeWithResources({
      platform: Platforms.GITHUB,
      orgName: context.params.organization,
      repoName: context.params.repo,
      number: parseInt(context.params.number),
      include: 'issue,organization,repository',
    })
    const { organization, repository, issue } = res
    return { props: { organization, repository, issue, query: context.query } }
  } catch (Error) {
    return { props: {} }
  }
}

export default PledgePage
