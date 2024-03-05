'use client'

import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import SubscriptionTierSubscribeButton from '@/components/Subscriptions/SubscriptionTierSubscribeButton'
import { ListResourceSubscriptionTier, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { LogoIcon } from 'polarkit/components/brand'
import { Avatar, Button } from 'polarkit/components/ui/atoms'
import { useListAdminOrganizations } from 'polarkit/hooks'
import { organizationPageLink } from 'polarkit/utils/nav'
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

  const highlightedTiers = useMemo(() => {
    return subscriptionTiers.items?.filter((tier) => tier.is_highlighted) ?? []
  }, [subscriptionTiers])

  const selectedTier = useMemo(
    () => highlightedTiers[selectedTierIndex],
    [highlightedTiers, selectedTierIndex],
  )

  return (
    <div className="flex w-full flex-col items-center gap-y-16 py-16">
      <div className="flex flex-row items-center justify-center">
        <a href="/">
          <LogoIcon className="text-blue-500 dark:text-blue-400" size={40} />
        </a>
      </div>
      <div className="flex flex-col items-center gap-y-6 text-center">
        <Link href={organizationPageLink(organization)}>
          <Avatar
            className="h-16 w-16"
            avatar_url={organization.avatar_url}
            name={organization.name}
          />
        </Link>
        <div className="flex flex-col items-center gap-y-2">
          <h3 className="text-2xl">Thank you for your subscription</h3>
          <p className="dark:text-polar-500 text-lg text-gray-500">
            Consider subscribing to a paid tier to support {organization.name}
          </p>
        </div>
      </div>
      <div className="flex max-w-5xl flex-row flex-wrap gap-8">
        {highlightedTiers.map((tier, index) => (
          <div
            className={twMerge(
              'flex w-full cursor-pointer flex-col rounded-3xl transition-shadow md:w-[300px]',
              selectedTierIndex === index
                ? 'shadow-2xl grayscale-0'
                : 'grayscale hover:grayscale-0',
            )}
            key={tier.id}
            onClick={() => selectTierIndex(index)}
          >
            <SubscriptionTierCard
              className={twMerge(
                'h-full w-full self-stretch',
                selectedTierIndex === index && 'border-transparent',
              )}
              subscriptionTier={tier}
            />
          </div>
        ))}
      </div>
      <div className="flex w-48 flex-col items-center gap-y-4">
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
              subscribePath="/api/subscribe"
              variant="default"
            />
          ))}
        <Link href={organizationPageLink(organization)}>
          <Button variant="ghost">Skip</Button>
        </Link>
      </div>
    </div>
  )
}
