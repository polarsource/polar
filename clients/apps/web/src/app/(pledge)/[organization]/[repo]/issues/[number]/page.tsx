import Pledge from '@/components/Pledge/Pledge'
import PageNotFound from '@/components/Shared/PageNotFound'
import Head from 'next/head'
import { api } from 'polarkit'

export default async function Page({
  params,
}: {
  params: { organization: string; repo: string; number: string }
}) {
  const res = await api.issues.lookup({
    externalUrl: `https://github.com/${params.organization}/${params.repo}/issues/${params.number}`,
  })

  const issue = res

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

      <Pledge issue={issue} asOrg={undefined} gotoURL={undefined} />
    </>
  )
}
