'use client'

import { Subscription } from '@polar-sh/sdk'
import Link from 'next/link'
import { api } from 'polarkit'
import {
  Button,
  FormattedDateTime,
  ShadowListGroup,
} from 'polarkit/components/ui/atoms'
import { useOrganization, useUser, useUserSubscriptions } from 'polarkit/hooks'
import { useCallback, useState } from 'react'
import SubscriptionTierPill from '../Subscriptions/SubscriptionTierPill'

export type Settings = {
  email_newsletters_and_changelogs?: boolean
  email_promotions_and_events?: boolean
}

const SubscriptionSettings = () => {
  const user = useUser()

  const subscriptions = useUserSubscriptions(
    user.data?.id ?? '',
    undefined,
    true,
  )

  return (
    <ShadowListGroup>
      {subscriptions.data?.items && subscriptions.data.items.length > 0 ? (
        subscriptions.data?.items?.map((subscription) => {
          return (
            <SubscriptionItem
              key={subscription.id}
              subscription={subscription}
            />
          )
        })
      ) : (
        <ShadowListGroup.Item>
          <p className="dark:text-polar-400 text-sm text-gray-500">
            You don&apos;t have any active Subscriptions.
          </p>
        </ShadowListGroup.Item>
      )}
    </ShadowListGroup>
  )
}

export default SubscriptionSettings

interface SubscriptionItemProps {
  subscription: Subscription
}

const SubscriptionItem = ({ subscription }: SubscriptionItemProps) => {
  const [stripePortalLoading, setStripePortalLoading] = useState(false)

  const onGotoStripeCustomerPortal = useCallback(async () => {
    setStripePortalLoading(true)

    const portal = await api.users.createStripeCustomerPortal()
    if (portal) {
      window.open(portal.url, '_blank')
    }

    setStripePortalLoading(false)
  }, [])

  const organization = useOrganization(
    subscription.subscription_tier.organization_id ?? '',
  )

  if (!organization.data) {
    return null
  }

  return (
    <ShadowListGroup.Item>
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-y-3">
          <Link
            className="dark:text-polar-50 flex flex-row items-center gap-x-2 text-gray-950"
            href={`/${organization.data?.name}`}
          >
            <h3>{organization.data?.name}</h3>
          </Link>
          <div className="dark:text-polar-400 flex flex-row items-center gap-x-3 text-sm text-gray-500">
            <Link href={`/${organization.data?.name}?tab=subscriptions`}>
              <SubscriptionTierPill
                amount={subscription.subscription_tier.price_amount}
                subscriptionTier={subscription.subscription_tier}
              />
            </Link>
            {subscription.current_period_end && (
              <>
                &middot;
                <span
                  className={
                    subscription.cancel_at_period_end
                      ? 'text-red-500'
                      : undefined
                  }
                >
                  <span>
                    {subscription.cancel_at_period_end
                      ? 'Ends on '
                      : 'Renews on '}
                  </span>
                  <FormattedDateTime
                    datetime={new Date(subscription.current_period_end ?? '')}
                    dateStyle="long"
                  />
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-row gap-x-2">
          <Button
            className="text-sm"
            size="sm"
            variant="secondary"
            onClick={onGotoStripeCustomerPortal}
            loading={stripePortalLoading}
          >
            Manage
          </Button>
        </div>
      </div>
    </ShadowListGroup.Item>
  )
}
