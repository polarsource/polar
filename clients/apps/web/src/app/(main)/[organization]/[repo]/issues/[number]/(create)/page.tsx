import { getServerSideAPI } from '@/utils/client/serverside'
import { resolveIssuePath } from '@/utils/issue'
import { organizationPageLink } from '@/utils/nav'
import { schemas, unwrap } from '@polar-sh/client'
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
  let pledgers: schemas['Pledger'][] = []
  let rewards: schemas['RewardsSummary'] | undefined

  const [bodyResponse, pledgeSummary, rewardsSummary] = await Promise.all([
    unwrap(
      api.GET('/v1/issues/{id}/body', {
        params: { path: { id: issue.id } },
        next: { revalidate: 60 },
      }),
    ), // Cache for 60s
    unwrap(
      api.GET('/v1/pledges/summary', {
        params: { query: { issue_id: issue.id } },
        ...cacheConfig,
      }),
    ),
    unwrap(
      api.GET('/v1/rewards/summary', {
        params: { query: { issue_id: issue.id } },
        ...cacheConfig,
      }),
    ),
  ])

  issueHTMLBody = bodyResponse as string
  pledgers = pledgeSummary.pledges
    .map(({ pledger }) => pledger)
    .filter((p): p is schemas['Pledger'] => !!p)
  rewards = rewardsSummary

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
