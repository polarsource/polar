'use client'

import { Field } from '@/components/Events/EventDetailField'
import { IconButton, Section } from '@/components/Events/EventDetailPanel'
import { EventTimestamp } from '@/components/Events/EventTimestamp'
import { EntityLink } from '@/components/Shared/EntityLink'
import { SidePanel } from '@/components/Shared/SidePanel'
import { useSubscriptions } from '@/hooks/queries'
import { withOrderActivity } from '@/utils/subscriptionOrderActivity'
import { getSubscriptionActivity } from '@/utils/subscriptionSummary'
import { useOrders } from '@/hooks/queries/orders'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronDown, ChevronUp, X } from '@polar-sh/orbit/icons'
import { format } from 'date-fns'
import Link from 'next/link'
import { useState } from 'react'
import { CatalogVersionLabel } from '@/components/Products/CatalogVersionLabel'
import { SubscriptionActivityList } from './SubscriptionActivityList'
import {
  formatRecurringSchedule,
  getCancellationReason,
  getSubscriptionKeyDates,
} from './SubscriptionDetailsGrid'
import { SubscriptionSidePanelCustomer } from './SubscriptionSidePanelCustomer'
import { SubscriptionStatus } from './SubscriptionStatus'
import { SubscriptionStatusIcon } from './SubscriptionStatusIcon'
import { SubscriptionSummary } from './SubscriptionSummary'
import { useSubscriptionDunning } from './useSubscriptionDunning'
import { formatSubscriptionPrice, getSubscriptionStatusLabel } from './utils'

// The panel's label column is narrow, so the longer names are cut down.
const SHORT_DATE_LABELS: Record<string, string> = {
  'Renewal date': 'Renews',
  'Ending date': 'Ends',
  'Pauses on': 'Pauses',
  'Paused on': 'Paused',
  'Resumes on': 'Resumes',
}

const ROW_CLASS =
  'dark:hover:bg-polar-800 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-gray-100'

const formatDate = (value: string) => format(new Date(value), 'MMM d, yyyy')

// The subscription at a glance and who it belongs to, in the same panel the
// subscriptions list opens beside it.
interface SubscriptionSidePanelProps {
  organization: schemas['Organization']
  subscription: schemas['Subscription']
  // Given where the panel was opened from a list. It then has a header to
  // step through the list and close it, and a way to the subscription's page.
  // Without it the panel is always there, beside that page.
  navigation?: {
    onPrevious?: () => void
    onNext?: () => void
    onClose: () => void
  }
}

export const SubscriptionSidePanel = ({
  organization,
  subscription,
  navigation,
}: SubscriptionSidePanelProps) => {
  const { customer, discount } = subscription
  const cancellationReason = getCancellationReason(subscription)
  const subscriptionsPath = `/dashboard/${organization.slug}/sales/subscriptions?view=list`
  const [today] = useState(() => new Date())
  const dunning = useSubscriptionDunning(organization.id, subscription.id)
  // The same request the subscription page's orders table makes.
  const { data: orders } = useOrders(organization.id, {
    subscription_id: [subscription.id],
    sorting: ['-created_at'],
    limit: 100,
  })
  const activity = withOrderActivity(
    getSubscriptionActivity(
      subscription,
      today.getTime(),
      dunning,
      orders?.items,
    ),
    orders?.items ?? [],
  )
  const { data: subscriptions } = useSubscriptions(organization.id, {
    customer_id: [customer.id],
    limit: 20,
  })
  const others = (subscriptions?.items ?? []).filter(
    ({ id }) => id !== subscription.id,
  )

  return (
    <SidePanel persistent={!navigation}>
      {navigation && (
        <Box
          alignItems="center"
          justifyContent="between"
          gap="s"
          paddingLeft="l"
          paddingRight="m"
          paddingTop="m"
        >
          <Text variant="body" truncate>
            Subscription
          </Text>
          <Box alignItems="center" flexShrink={0}>
            <IconButton
              label="Previous subscription"
              onClick={navigation.onPrevious}
              disabled={!navigation.onPrevious}
            >
              <ChevronUp className="h-4 w-4" />
            </IconButton>
            <IconButton
              label="Next subscription"
              onClick={navigation.onNext}
              disabled={!navigation.onNext}
            >
              <ChevronDown className="h-4 w-4" />
            </IconButton>
            <IconButton label="Close" onClick={navigation.onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </Box>
        </Box>
      )}
      <SubscriptionSummary
        subscription={subscription}
        organization={organization}
        showProduct={false}
        showStatus={false}
      />

      <Box flexDirection="column" paddingHorizontal="l" paddingBottom="m">
        <Field label="Status">
          <Text as="div">
            <SubscriptionStatus subscription={subscription} />
          </Text>
        </Field>
        <Field label="Product">
          <EntityLink
            kind="product"
            href={`/dashboard/${organization.slug}/products/${subscription.product.id}`}
            menuItems={[
              { label: 'Copy product ID', copy: subscription.product.id },
              {
                label: 'View subscriptions',
                href: `${subscriptionsPath}&product_id=${subscription.product.id}`,
              },
            ]}
          >
            {subscription.product.name}
          </EntityLink>
          <CatalogVersionLabel
            organization={organization}
            version={subscription.product}
          />
        </Field>
        <Field label="Schedule">
          <Text>
            {formatRecurringSchedule(
              subscription.recurring_interval,
              subscription.recurring_interval_count,
            )}
          </Text>
        </Field>
        {getSubscriptionKeyDates(subscription).map(({ label, datetime }) => (
          <Field key={label} label={SHORT_DATE_LABELS[label] ?? label}>
            {datetime ? (
              <EventTimestamp timestamp={datetime}>
                <Text tabularNums>{formatDate(datetime)}</Text>
              </EventTimestamp>
            ) : (
              <Text color="muted">Until resumed</Text>
            )}
          </Field>
        ))}
        {discount && (
          <Field label="Discount">
            <EntityLink
              kind="discount"
              href={`/dashboard/${organization.slug}/products/discounts?query=${discount.code}`}
              menuItems={[
                { label: 'Copy discount ID', copy: discount.id },
                ...(discount.code
                  ? [{ label: 'Copy code', copy: discount.code }]
                  : []),
                {
                  label: 'View subscriptions',
                  href: `${subscriptionsPath}&discount_id=${discount.id}`,
                },
              ]}
            >
              {discount.name}
            </EntityLink>
          </Field>
        )}
        {cancellationReason && (
          <Field label="Reason">
            <EntityLink
              kind="filter"
              href={`/dashboard/${organization.slug}/sales/subscriptions?customer_cancellation_reason=${subscription.customer_cancellation_reason}`}
            >
              {cancellationReason}
            </EntityLink>
          </Field>
        )}
        {subscription.customer_cancellation_comment && (
          <Field label="Comment">
            <Text wrap="pretty">
              {subscription.customer_cancellation_comment}
            </Text>
          </Field>
        )}
        <Field label="ID" copyValue={subscription.id}>
          <Text truncate monospace>
            {subscription.id}
          </Text>
        </Field>
      </Box>

      {navigation && (
        <Box paddingHorizontal="l" paddingTop="s" paddingBottom="l">
          <Link
            href={`/dashboard/${organization.slug}/sales/subscriptions/${subscription.id}`}
            className="flex-1"
          >
            <Button fullWidth>Manage</Button>
          </Link>
        </Box>
      )}

      <SubscriptionSidePanelCustomer
        organization={organization}
        customer={customer}
        today={today}
      />

      {others.length > 0 && (
        <Section title="Other subscriptions">
          <Box flexDirection="column">
            {others.map((other) => (
              <Link
                key={other.id}
                href={`/dashboard/${organization.slug}/sales/subscriptions/${other.id}`}
                className={ROW_CLASS}
              >
                <Box flexDirection="column" minWidth={0}>
                  <Text truncate>{other.product.name}</Text>
                  <Box alignItems="center" gap="s">
                    <SubscriptionStatusIcon subscription={other} />
                    <Text color="muted">
                      {getSubscriptionStatusLabel(other)}
                    </Text>
                  </Box>
                </Box>
                <Text tabularNums wrap="nowrap">
                  {formatSubscriptionPrice(other)}
                </Text>
              </Link>
            ))}
          </Box>
        </Section>
      )}

      <Section title="Activity">
        <SubscriptionActivityList
          activity={activity}
          organizationSlug={organization.slug}
        />
      </Section>
    </SidePanel>
  )
}
