import Pledge from '@/components/Pledge'
import HowItWorks from '@/components/Pledge/HowItWorks'
import PageNotFound from '@/components/Shared/PageNotFound'
import type { GetServerSideProps, NextPage } from 'next'
import Head from 'next/head'
import { api } from 'polarkit'
import { Platforms, PledgeResources } from 'polarkit/api/client'
import { posthog } from 'posthog-js'
import { useEffect } from 'react'

type Params = PledgeResources & {
  query?: {
    as_org?: string
    goto_url?: string
  }
}

const PledgePage: NextPage = ({
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
      </Head>
      <div className="mx-auto mt-12 mb-24 flex w-full flex-col gap-12 md:mt-24 md:w-[826px]">
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
      </div>
    </>
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
