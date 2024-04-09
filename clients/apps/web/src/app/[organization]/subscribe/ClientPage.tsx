'use client'

import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import SubscriptionTierRecurringIntervalSwitch from '@/components/Subscriptions/SubscriptionTierRecurringIntervalSwitch'
import SubscriptionTierSubscribeButton from '@/components/Subscriptions/SubscriptionTierSubscribeButton'
import { useRecurringInterval } from '@/hooks/subscriptions'
import { ListResourceSubscriptionTier, Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { LogoIcon } from 'polarkit/components/brand'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import { useListAdminOrganizations } from 'polarkit/hooks'
import { hasRecurringInterval } from 'polarkit/subscriptions'
import { organizationPageLink } from 'polarkit/utils/nav'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function ClientPage({
  organization,
  subscriptionTiers,
}: {
  organization: Organization
  subscriptionTiers: ListResourceSubscriptionTier
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
  const [recurringInterval, setRecurringInterval, hasBothIntervals] =
    useRecurringInterval(highlightedTiers)

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
      <div className="flex flex-col items-center justify-center gap-y-12">
        {hasBothIntervals && (
          <SubscriptionTierRecurringIntervalSwitch
            recurringInterval={recurringInterval}
            onChange={setRecurringInterval}
          />
        )}
        <div className="flex max-w-5xl flex-row flex-wrap gap-8">
          {highlightedTiers
            .filter(hasRecurringInterval(recurringInterval))
            .map((tier, index) => (
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
                  recurringInterval={recurringInterval}
                />
              </div>
            ))}
        </div>
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
              recurringInterval={recurringInterval}
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
