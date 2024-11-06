import { getServerSideAPI } from '@/utils/api/serverside'
import { resolveIssuePath } from '@/utils/issue'
import { organizationPageLink } from '@/utils/nav'
import { Pledger, ResponseError, RewardsSummary } from '@polar-sh/sdk'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import ClientPage from './ClientPage'

const cacheConfig = {
  cache: 'no-store',
} as const

export async function generateMetadata({
  params,
}: {
  params: { organization: string; repo: string; number: string }
}): Promise<Metadata> {
  const api = getServerSideAPI()
  const resolvedIssueOrganization = await resolveIssuePath(
    api,
    params.organization,
    params.repo,
    params.number,
    cacheConfig,
  )

  if (!resolvedIssueOrganization) {
    notFound()
  }

  const [issue, organization] = resolvedIssueOrganization

  // Redirect to the actual Polar organization if resolved from external organization
  if (organization.slug !== params.organization) {
    redirect(
      organizationPageLink(
        organization,
        `${issue.repository.name}/issues/${issue.number}`,
      ),
    )
  }

  return {
    title: `Fund: ${issue.title}`, // " | Polar is added by the template"
    openGraph: {
      title: `Fund: ${issue.title}`,
      description: `${issue.repository.organization.name} seeks funding for ${issue.title} Polar`,
      type: 'website',
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
  const api = getServerSideAPI()
  const resolvedIssueOrganization = await resolveIssuePath(
    api,
    params.organization,
    params.repo,
    params.number,
    cacheConfig,
  )

  if (!resolvedIssueOrganization) {
    notFound()
  }

  const [issue, organization] = resolvedIssueOrganization

  // Redirect to the actual Polar organization if resolved from external organization
  if (organization.slug !== params.organization) {
    redirect(
      organizationPageLink(
        organization,
        `${issue.repository.name}/issues/${issue.number}`,
      ),
    )
  }

  let issueHTMLBody: string | undefined
  let pledgers: Pledger[] = []
  let rewards: RewardsSummary | undefined

  try {
    const [bodyResponse, pledgeSummary, rewardsSummary] = await Promise.all([
      api.issues.getBody({ id: issue.id }, { next: { revalidate: 60 } }), // Cache for 60s
      api.pledges.summary({ issueId: issue.id }, cacheConfig),
      api.rewards.summary({ issueId: issue.id }, cacheConfig),
    ])

    issueHTMLBody = bodyResponse
    pledgers = pledgeSummary.pledges
      .map(({ pledger }) => pledger)
      .filter((p): p is Pledger => !!p)
    rewards = rewardsSummary
  } catch (e) {
    if (e instanceof ResponseError && e.response.status === 404) {
      notFound()
    }
  }

  // Closed issue, redirect to donation instead if linked organization
  if (issue.issue_closed_at) {
    redirect(organizationPageLink(organization, `donate?issue_id=${issue.id}`))
  }

  return (
    <ClientPage
      issue={issue}
      organization={organization}
      htmlBody={issueHTMLBody}
      pledgers={pledgers}
      rewards={rewards}
      gotoURL={undefined}
    />
  )
}
