'use client'

import { Benefit, resolveBenefitTypeIcon } from '@/components/Benefit/Benefit'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import SubscriptionGroupIcon from '@/components/Subscriptions/SubscriptionGroupIcon'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { AddOutlined } from '@mui/icons-material'
import { Organization, SubscriptionTier } from '@polar-sh/sdk'
import Link from 'next/link'
import { Button, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { twMerge } from 'tailwind-merge'

const ClientPage = ({
  subscriptionTiers,
}: {
  subscriptionTiers: SubscriptionTier[]
}) => {
  const { org } = useCurrentOrgAndRepoFromURL()

  if (!org) {
    return null
  }

  return (
    <DashboardBody>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-lg font-medium">Benefits</h2>
          <Link href={`/maintainer/${org?.name}/subscriptions/benefits/new`}>
            <Button className="h-8 w-8 rounded-full">
              <AddOutlined fontSize="inherit" />
            </Button>
          </Link>
        </div>
        <StaggerReveal className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-4">
          {subscriptionTiers.map((tier) => (
            <SubscriptionTier key={tier.id} tier={tier} organization={org} />
          ))}
        </StaggerReveal>
      </div>
    </DashboardBody>
  )
}

export default ClientPage

interface SubscriptionTierProps {
  organization: Organization
  tier: SubscriptionTier
}

const SubscriptionTier = ({ tier, organization }: SubscriptionTierProps) => {
  return (
    <div className="flex flex-row items-start gap-x-12 py-8">
      <div className="flex flex-col gap-y-4">
        <div className="flex w-64 flex-row gap-x-2 text-lg">
          <span className="flex text-xl">
            <SubscriptionGroupIcon type={tier.type} />
          </span>
          <h2>{tier.name}</h2>
        </div>
        <p className="dark:text-polar-500 text-gray-500">{tier.description}</p>
      </div>
      <ShadowBoxOnMd className="flex flex-col gap-y-8">
        <StaggerReveal key={tier.id} className="flex flex-col gap-y-4">
          {tier.benefits.map((benefit) => (
            <StaggerReveal.Child key={benefit.id}>
              <SubscriptionBenefit benefit={benefit} />
            </StaggerReveal.Child>
          ))}
        </StaggerReveal>
      </ShadowBoxOnMd>
    </div>
  )
}

interface SubscriptionBenefitProps {
  benefit: Benefit
}

const SubscriptionBenefit = ({ benefit }: SubscriptionBenefitProps) => {
  const BenefitTypeIcon = resolveBenefitTypeIcon(benefit.type)

  return (
    <div
      className={twMerge(
        'flex flex-row justify-between gap-x-8 rounded-2xl shadow-sm transition-colors',
      )}
    >
      <div className="flex flex-row items-center gap-x-4">
        <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-blue-400">
          <span className="flex h-10 w-10 flex-row items-center justify-center rounded-full bg-blue-50 text-sm dark:bg-blue-950">
            <BenefitTypeIcon fontSize="small" />
          </span>
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-medium capitalize">{benefit.type}</h3>
          <p className="dark:text-polar-500 flex flex-row gap-x-1 truncate text-sm text-gray-500">
            {benefit.description}
          </p>
        </div>
      </div>
    </div>
  )
}
