'use client'

import { resolveBenefitIcon } from '@/components/Benefit/utils'
import GitHubIcon from '@/components/Icons/GitHubIcon'
import { useOrganization } from '@/hooks/queries'
import { UserBenefit } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'

interface BenefitDetailsProps {
  benefit: UserBenefit
}

const GitHubRepoWidget = ({ benefit }: BenefitDetailsProps) => {
  if (benefit.type !== 'github_repository') {
    return <></>
  }

  const orgName = benefit.properties.repository_owner
  const repoName = benefit.properties.repository_name
  const githubURL = `https://github.com/${orgName}/${repoName}`

  return (
    <>
      <Link href={`${githubURL}/invitations`}>
        <Button variant="outline" asChild>
          <GitHubIcon width={16} height={16} className="mr-2" />
          Goto {orgName}/{repoName}
        </Button>
      </Link>
    </>
  )
}

const BenefitDetails = ({ benefit }: BenefitDetailsProps) => {
  const { data: org } = useOrganization(benefit.organization_id)

  if (!org) {
    return <></>
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-row items-center gap-x-2">
        <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-blue-400">
          <span className="flex h-6 w-6 flex-row items-center justify-center rounded-full bg-blue-50 text-sm dark:bg-blue-950">
            {resolveBenefitIcon(benefit, 'inherit')}
          </span>
        </div>
        <h2 className="font-medium capitalize">
          {benefit.type === 'github_repository'
            ? 'GitHub Repository Access'
            : benefit.type}
        </h2>
      </div>
      <p className="dark:text-polar-500 text-sm text-gray-500">
        {benefit.description}
      </p>
      {benefit.type === 'custom' && benefit.properties.note && (
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm dark:bg-blue-950">
          <p className="mb-4 font-medium">Note from {org.name}</p>
          <p className="whitespace-pre-line">{benefit.properties.note}</p>
        </div>
      )}

      {benefit.type === 'github_repository' && (
        <GitHubRepoWidget benefit={benefit} />
      )}

      {/* FIXME: Ads support for any product */}
      {/* {benefit.type === 'ads' ? (
        <ConfigureAdCampaigns benefit={benefit} subscription={subscription} />
      ) : null} */}
    </div>
  )
}

export default BenefitDetails
