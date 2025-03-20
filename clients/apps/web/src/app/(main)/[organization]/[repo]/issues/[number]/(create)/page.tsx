import { getServerSideAPI } from '@/utils/client/serverside'
import { resolveIssuePath } from '@/utils/issue'
import { organizationPageLink } from '@/utils/nav'
import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

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

  return (
    <div className="flex w-full justify-center">
      <div className="w-full rounded-2xl bg-yellow-50 px-4 py-3 text-sm text-yellow-500 lg:w-1/2 dark:bg-yellow-950">
        <h1 className="text-2xl">
          We&apos;re sunsetting GitHub Issue Funding at Polar
        </h1>
        <p>Sorry, we do not accept new pledges on issues.</p>
      </div>
    </div>
  )
}
