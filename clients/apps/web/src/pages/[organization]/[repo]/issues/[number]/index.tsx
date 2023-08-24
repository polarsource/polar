import PublicLayout from '@/components/Layout/PublicLayout'
import TopbarLayout from '@/components/Layout/TopbarLayout'
import Pledge from '@/components/Pledge/Pledge'
import PageNotFound from '@/components/Shared/PageNotFound'
import type { GetServerSideProps, NextLayoutComponentType } from 'next'
import Head from 'next/head'
import { api } from 'polarkit'
import { Issue } from 'polarkit/api/client'
import { posthog } from 'posthog-js'
import { ReactElement, useEffect } from 'react'

type Params = {
  issue?: Issue
  query?: {
    as_org?: string
    goto_url?: string
  }
}

const PledgePage: NextLayoutComponentType = ({ issue, query }: Params) => {
  useEffect(() => {
    if (issue) {
      posthog.capture('Pledge page shown', {
        'Organization ID': issue.repository.organization.id,
        'Organization Name': issue.repository.organization.name,
        'Repository ID': issue.repository.id,
        'Repository Name': issue.repository.name,
        'Issue ID': issue.id,
        'Issue Number': issue.number,
      })
    }
  }, [issue])

  if (!issue) {
    return <PageNotFound />
  }

  return (
    <>
      <Head>
        <title>Polar | Fund: {issue.title}</title>
        <meta property="og:title" content={`Fund: ${issue.title}`} />
        <meta
          property="og:description"
          content={`${issue.repository.organization.name} seeks funding for ${issue.title} Polar`}
        />
        <meta name="og:site_name" content="Polar"></meta>
        <meta
          property="og:image"
          content={`https://polar.sh/og?org=${issue.repository.organization.name}&repo=${issue.repository.name}&number=${issue.number}`}
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <meta
          property="twitter:image"
          content={`https://polar.sh/og?org=${issue.repository.organization.name}&repo=${issue.repository.name}&number=${issue.number}`}
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:image:alt"
          content={`${issue.repository.organization.name} seeks funding for ${issue.title} Polar`}
        />
        <meta name="twitter:title" content={`Back ${issue.title}`} />
        <meta
          name="twitter:description"
          content={`${issue.repository.organization.name} seeks funding for ${issue.title} Polar`}
        ></meta>
      </Head>

      <Pledge issue={issue} asOrg={query?.as_org} gotoURL={query?.goto_url} />
    </>
  )
}

PledgePage.getLayout = (page: ReactElement) => {
  return (
    <TopbarLayout logoPosition="center" isFixed={false}>
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

    const res = await api.issues.lookup({
      externalUrl: `https://github.com/${context.params.organization}/${context.params.repo}/issues/${context.params.number}`,
    })
    return { props: { issue: res, query: context.query } }
  } catch (Error) {
    return { props: {} }
  }
}

export default PledgePage
