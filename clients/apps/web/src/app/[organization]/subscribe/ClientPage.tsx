'use client'

import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import SubscriptionTierSubscribeButton from '@/components/Subscriptions/SubscriptionTierSubscribeButton'
import { organizationPageLink } from '@/utils/nav'
import { ListResourceSubscriptionTier, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { Avatar, Button } from 'polarkit/components/ui/atoms'
import { useListAdminOrganizations } from 'polarkit/hooks'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function ClientPage({
  organization,
  subscriptionTiers,
  email,
}: {
  organization: Organization
  subscriptionTiers: ListResourceSubscriptionTier
  email?: string
}) {
  const [selectedTierIndex, selectTierIndex] = useState(0)

  const orgs = useListAdminOrganizations()

  const shouldRenderSubscribeButton = useMemo(
    () => !orgs.data?.items?.map((o) => o.id).includes(organization.id),
    [organization, orgs],
  )

  const sortedTiers = useMemo(() => {
    const [freeTier, ...rest] = subscriptionTiers.items ?? []
    return [...rest, freeTier]
  }, [subscriptionTiers])

  const selectedTier = useMemo(
    () => sortedTiers[selectedTierIndex],
    [sortedTiers, selectedTierIndex],
  )

  return (
    <div className="flex w-full flex-col items-center gap-y-16 py-16">
      <div className="flex flex-col items-center gap-y-6 text-center">
        <Avatar
          className="h-12 w-12"
          avatar_url={organization.avatar_url}
          name={organization.name}
        />
        <div className="flex flex-col items-center gap-y-2">
          <h3 className="text-2xl">Select a subscription tier</h3>
          <p className="dark:text-polar-500 text-lg text-gray-500">
            Support {organization.name} with a subscription
          </p>
        </div>
      </div>
      <div className="flex max-w-5xl flex-row flex-wrap gap-8">
        {sortedTiers.map((tier, index) => (
          <div
            className={twMerge(
              'flex cursor-pointer flex-col rounded-3xl transition-shadow',
              selectedTierIndex === index
                ? 'shadow-2xl grayscale-0'
                : 'grayscale hover:grayscale-0',
            )}
            key={tier.id}
            onClick={() => selectTierIndex(index)}
          >
            <SubscriptionTierCard
              className={twMerge(
                'h-full w-full self-stretch md:max-w-[300px]',
                selectedTierIndex === index && 'border-transparent',
              )}
              subscriptionTier={tier}
            />
          </div>
        ))}
      </div>
      <div className="flex w-48 flex-row items-center">
        {selectedTier &&
          shouldRenderSubscribeButton &&
          (selectedTier.type === 'free' ? (
            <Link className="w-full" href={organizationPageLink(organization)}>
              <Button fullWidth>Subscribe</Button>
            </Link>
          ) : (
            <SubscriptionTierSubscribeButton
              organization={organization}
              subscriptionTier={selectedTier}
              subscribePath="/subscribe"
            />
          ))}
      </div>
    </div>
  )
}
