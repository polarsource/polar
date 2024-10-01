'use client'

import GitHubIcon from '@/components/Icons/GitHubIcon'
import { useOrganization } from '@/hooks/queries'
import { UserBenefit, UserOrder, UserSubscription } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import DownloadablesSubscriberWidget from './Downloadables/SubscriberWidget'
import { LicenseKeysSubscriberWidget } from './LicenseKeys/SubscriberWidget'
import ConfigureAdCampaigns from './ads/ConfigureAdCampaigns'
import { resolveBenefitIcon } from './utils'

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

interface BenefitDetailsProps {
  benefit: UserBenefit
  order?: UserOrder
  subscription?: UserSubscription
}

const BenefitDetails = ({
  benefit,
  order,
  subscription,
}: BenefitDetailsProps) => {
  const { data: org } = useOrganization(benefit.organization_id)

  if (!org) {
    return <></>
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-row items-start gap-x-3 align-middle">
        <span className="dark:bg-polar-700 flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-500 dark:text-white">
          {resolveBenefitIcon(benefit, 'inherit', 'h-3 w-3')}
        </span>
        <span className="text-sm">{benefit.description}</span>
      </div>
      {benefit.type === 'custom' && benefit.properties.note && (
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm dark:bg-blue-950">
          <p className="mb-4 font-medium">Note from {org.name}</p>
          <p className="whitespace-pre-line">{benefit.properties.note}</p>
        </div>
      )}

      {benefit.type === 'github_repository' && (
        <GitHubRepoWidget benefit={benefit} />
      )}

      {benefit.type === 'ads' ? (
        <ConfigureAdCampaigns benefit={benefit} />
      ) : null}

      {benefit.type === 'downloadables' ? (
        <DownloadablesSubscriberWidget benefit={benefit} />
      ) : null}

      {benefit.type === 'license_keys' ? (
        <LicenseKeysSubscriberWidget
          benefit={benefit}
          order={order}
          subscription={subscription}
        />
      ) : null}
    </div>
  )
}

export default BenefitDetails
