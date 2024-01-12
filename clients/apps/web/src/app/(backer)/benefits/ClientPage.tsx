'use client'

import {
  BenefitSubscriber,
  resolveBenefitTypeIcon,
} from '@/components/Benefit/Benefit'
import { BenefitRow } from '@/components/Benefit/BenefitRow'
import { StaggerReveal } from '@/components/Shared/StaggerReveal'
import { DiamondOutlined } from '@mui/icons-material'
import {
  SubscriptionSubscriber,
  SubscriptionTierSubscriber,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { Avatar, Button, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { Separator } from 'polarkit/components/ui/separator'
import { useOrganization } from 'polarkit/hooks'
import { useState } from 'react'

const ClientPage = ({
  subscriptions,
}: {
  subscriptions: SubscriptionSubscriber[]
}) => {
  const [selectedBenefit, setSelectedBenefit] = useState<
    BenefitSubscriber | undefined
  >(subscriptions[0].subscription_tier.benefits[0])

  return subscriptions.length === 0 ? (
    <div className="dark:text-polar-400 flex h-full flex-col items-center gap-y-4 pt-32 text-6xl text-gray-600">
      <DiamondOutlined fontSize="inherit" />
      <div className="flex flex-col items-center gap-y-2">
        <h3 className="p-2 text-xl font-medium">You have no benefits</h3>
        <p className="dark:text-polar-500 min-w-0 truncate text-base text-gray-500">
          Unlock benefits by subscribing to creators
        </p>
      </div>
    </div>
  ) : (
    <div className="relative flex flex-row items-start gap-x-12">
      <div className="flex w-2/3 flex-col gap-y-4">
        {subscriptions.map((subscription) => (
          <Subscription
            key={subscription.id}
            tier={subscription.subscription_tier}
            selectedBenefit={selectedBenefit}
            onSelectBenefit={setSelectedBenefit}
          />
        ))}
      </div>
      <BenefitContextWidget benefit={selectedBenefit} />
    </div>
  )
}

export default ClientPage

interface SubscriptionOrganizationProps {
  tier: SubscriptionTierSubscriber
  selectedBenefit: BenefitSubscriber | undefined
  onSelectBenefit: (benefit: BenefitSubscriber) => void
}

const Subscription = ({
  tier,
  selectedBenefit,
  onSelectBenefit,
}: SubscriptionOrganizationProps) => {
  const { data: org } = useOrganization(tier.organization_id ?? '')

  return (
    <ShadowBoxOnMd className="flex flex-col gap-y-8">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-row items-center gap-x-4">
          <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-blue-400">
            <Avatar
              className="h-10 w-10"
              avatar_url={org?.avatar_url}
              name={org?.name ?? ''}
            />
          </div>
          <div className="flex flex-col">
            <h2>{tier.name}</h2>
            <Link
              className="text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
              href={`/${org?.name}/subscriptions`}
            >
              {org?.pretty_name ?? org?.name}
            </Link>
          </div>
        </div>
        <div className="flex flex-row items-center gap-x-2">
          <Link href={`/settings`}>
            <Button size="sm" variant="secondary" asChild>
              Manage
            </Button>
          </Link>
          <Link href={`/${org?.name}/subscriptions`}>
            <Button size="sm" asChild>
              Upgrade
            </Button>
          </Link>
        </div>
      </div>
      <StaggerReveal key={tier.id} className="flex flex-col gap-y-2">
        {tier.benefits.map((benefit) => (
          <StaggerReveal.Child key={benefit.id}>
            <BenefitRow
              benefit={benefit}
              selected={benefit.id === selectedBenefit?.id}
              onSelect={onSelectBenefit}
            />
          </StaggerReveal.Child>
        ))}
      </StaggerReveal>
    </ShadowBoxOnMd>
  )
}

interface BenefitContextWidgetProps {
  benefit: BenefitSubscriber | undefined
}

const BenefitContextWidget = ({ benefit }: BenefitContextWidgetProps) => {
  const { data: org } = useOrganization(benefit?.organization_id ?? '')
  const BenefitTypeIcon = resolveBenefitTypeIcon(benefit?.type ?? 'custom')

  if (!benefit) {
    return null
  }

  return (
    <ShadowBoxOnMd className="sticky top-8 flex w-1/3 flex-col gap-y-6">
      <div className="flex flex-row items-center gap-x-2">
        <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-blue-400">
          <span className="flex h-6 w-6 flex-row items-center justify-center rounded-full bg-blue-50 text-sm dark:bg-blue-950">
            <BenefitTypeIcon fontSize="inherit" />
          </span>
        </div>
        <h2 className="font-medium capitalize">{benefit.type}</h2>
      </div>
      <p className="dark:text-polar-500 text-sm text-gray-500">
        {benefit.description}
      </p>
      {benefit.type === 'custom' && benefit.properties.note && (
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm dark:bg-blue-950">
          <p className="mb-4 font-medium">Note from {org?.name}</p>
          <p className="whitespace-pre-line">{benefit.properties.note}</p>
        </div>
      )}
      <Separator />
      <div className="flex flex-col gap-y-2">
        <div className="flex flex-row items-center gap-x-2">
          <Avatar
            className="h-6 w-6"
            avatar_url={org?.avatar_url}
            name={org?.name ?? ''}
          />
          <Link
            className="text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
            href={`/${org?.name}`}
          >
            {org?.name}
          </Link>
        </div>
      </div>
    </ShadowBoxOnMd>
  )
}
