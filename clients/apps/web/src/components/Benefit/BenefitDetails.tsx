'use client'

import GitHubIcon from '@/components/Icons/GitHubIcon'
import { UserBenefit, UserOrder, UserSubscription } from '@polar-sh/sdk'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'
import DownloadablesSubscriberWidget from './Downloadables/SubscriberWidget'
import { LicenseKeysSubscriberWidget } from './LicenseKeys/SubscriberWidget'
import ConfigureAdCampaigns from './ads/ConfigureAdCampaigns'
import { resolveBenefitTypeDisplayName } from './utils'

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
  const org = benefit.organization

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col">
        <h3 className="text-lg">{benefit.description}</h3>
        <span className="dark:text-polar-500 text-gray-500">
          {resolveBenefitTypeDisplayName(benefit.type)}
        </span>
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
