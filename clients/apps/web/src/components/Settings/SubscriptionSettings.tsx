'use client'

import { Subscription } from '@polar-sh/sdk'
import Link from 'next/link'
import {
  Button,
  FormattedDateTime,
  Pill,
  ShadowListGroup,
} from 'polarkit/components/ui/atoms'
import { useOrganization, useUser, useUserSubscriptions } from 'polarkit/hooks'
import { formatCurrencyAndAmount } from 'polarkit/money'
import SubscriptionGroupIcon from '../Subscriptions/SubscriptionGroupIcon'

export type Settings = {
  email_newsletters_and_changelogs?: boolean
  email_promotions_and_events?: boolean
}

const SubscriptionSettings = () => {
  const user = useUser()

  const subscriptions = useUserSubscriptions(user.data?.id ?? '')

  return (
    <ShadowListGroup>
      {subscriptions.data?.items && subscriptions.data.items.length > 0 ? (
        subscriptions.data?.items?.map((subscription) => {
          return <SubscriptionItem subscription={subscription} />
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
  const organization = useOrganization(
    subscription.subscription_tier.organization_id ?? '',
  )

  return (
    <ShadowListGroup.Item>
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-y-3">
          <div className="flex flex-row items-center gap-x-4">
            <div className="flex flex-row items-center gap-x-2">
              <SubscriptionGroupIcon
                className="h-2! w-2! text-lg"
                type={subscription.subscription_tier.type}
              />
              <h3>{subscription.subscription_tier.name}</h3>
            </div>
            <Pill className="px-2 py-1" color="blue">
              {formatCurrencyAndAmount(
                subscription.price_currency,
                subscription.price_amount,
                true,
              )}
            </Pill>
          </div>
          <div className="dark:text-polar-400 flex flex-row gap-x-2 text-sm text-gray-500">
            {organization.data?.name && (
              <>
                <Link
                  className="text-blue-600 hover:text-blue-400"
                  href={`/${organization.data?.name}`}
                >
                  {organization.data?.name}
                </Link>
                &middot;
              </>
            )}
            <span>
              <span>Renews on </span>
              <FormattedDateTime
                datetime={new Date(subscription.current_period_end ?? '')}
                dateStyle="long"
              />
            </span>
          </div>
        </div>
        <div className="flex flex-row gap-x-2">
          <Link
            className="text-blue-600 hover:text-blue-400"
            href={`/${organization.data?.name}?tab=subscriptions`}
          >
            <Button className="text-sm" size="sm" variant="ghost">
              View Benefits
            </Button>
          </Link>
          <Button className="text-sm" size="sm" variant="secondary">
            Manage
          </Button>
        </div>
      </div>
    </ShadowListGroup.Item>
  )
}
