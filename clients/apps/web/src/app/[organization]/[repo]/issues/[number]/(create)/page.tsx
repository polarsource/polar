import { getServerSideAPI } from '@/utils/api/serverside'
import { redirectToCanonicalDomain } from '@/utils/nav'
import {
  Issue,
  Pledger,
  PullRequest,
  ResponseError,
  RewardsSummary,
} from '@polar-sh/sdk'
import { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ClientPage from './ClientPage'

const cacheConfig = {
  cache: 'no-store',
} as const

export async function generateMetadata({
  params,
}: {
  params: { organization: string; repo: string; number: string }
}): Promise<Metadata> {
  let issue: Issue | undefined

  try {
    issue = await getServerSideAPI().issues.lookup(
      {
        externalUrl: `https://github.com/${params.organization}/${params.repo}/issues/${params.number}`,
      },
      cacheConfig,
    )
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    }
  }

  if (!issue) {
    return {}
  }

  return {
    title: `Fund: ${issue.title}`, // " | Polar is added by the template"
    openGraph: {
      title: `Fund: ${issue.title}`,
      description: `${issue.repository.organization.name} seeks funding for ${issue.title} Polar`,
      images: [
        {
          url: `https://polar.sh/og?org=${issue.repository.organization.name}&repo=${issue.repository.name}&number=${issue.number}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      images: [
        {
          url: `https://polar.sh/og?org=${issue.repository.organization.name}&repo=${issue.repository.name}&number=${issue.number}`,
          width: 1200,
          height: 630,
          alt: `${issue.repository.organization.name} seeks funding for ${issue.title} on Polar`,
        },
      ],
      card: 'summary_large_image',
      title: `${issue.repository.organization.name} seeks funding for ${issue.title}`,
      description: `${issue.repository.organization.name} seeks funding for ${issue.title} on Polar`,
    },
  }
}

export default async function Page({
  params,
}: {
  params: { organization: string; repo: string; number: string }
}) {
  let issue: Issue | undefined
  let issueHTMLBody: string | undefined
  let pledgers: Pledger[] = []
  let rewards: RewardsSummary | undefined
  let pulls: PullRequest[] = []

  const api = getServerSideAPI()

  try {
    issue = await api.issues.lookup(
      {
        externalUrl: `https://github.com/${params.organization}/${params.repo}/issues/${params.number}`,
      },
      cacheConfig,
    )

    const [bodyResponse, pledgeSummary, rewardsSummary, pullRequests] =
      await Promise.all([
        api.issues.getBody({ id: issue.id }, { next: { revalidate: 60 } }), // Cache for 60s
        api.pledges.summary({ issueId: issue.id }, cacheConfig),
        api.rewards.summary({ issueId: issue.id }, cacheConfig),
        api.pullRequests.search({ referencesIssueId: issue.id }, cacheConfig),
      ])

    issueHTMLBody = bodyResponse
    pledgers = pledgeSummary.pledges
      .map(({ pledger }) => pledger)
      .filter((p): p is Pledger => !!p)
    rewards = rewardsSummary
    pulls = pullRequests.items || []
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    }
  }

  if (!issue) {
    notFound()
  }

  redirectToCanonicalDomain({
    organization: issue.repository.organization,
    paramOrganizationName: params.organization,
    headers: headers(),
    subPath: `/${issue.repository.name}/issues/${issue.number}`,
  })

  return (
    <ClientPage
      issue={issue}
      htmlBody={issueHTMLBody}
      pledgers={pledgers}
      rewards={rewards}
      gotoURL={undefined}
      pullRequests={pulls}
    />
  )
}
