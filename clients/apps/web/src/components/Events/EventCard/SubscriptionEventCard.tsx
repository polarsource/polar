import AmountLabel from '@/components/Shared/AmountLabel'
import { useProduct } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined'
import { schemas } from '@polar-sh/client'
import { Status, type StatusColor } from '@polar-sh/orbit'
import Link from 'next/link'
import { useContext } from 'react'
import { EventCardBase } from './EventCardBase'

export interface SubscriptionEventCardProps {
  event:
    | schemas['SubscriptionCycledEvent']
    | schemas['SubscriptionRevokedEvent']
    | schemas['SubscriptionProductUpdatedEvent']
}

const subscriptionHref = (organizationSlug: string, subscriptionId: string) =>
  `/dashboard/${organizationSlug}/subscriptions?subscriptionId=${subscriptionId}`

const SubscriptionBillingEventCard = ({
  event,
  status,
}: {
  event:
    | schemas['SubscriptionCycledEvent']
    | schemas['SubscriptionRevokedEvent']
  status: [string, StatusColor]
}) => {
  const { organization } = useContext(OrganizationContext)
  const { data: product, isLoading } = useProduct(event.metadata.product_id)

  const { amount, currency, recurring_interval, recurring_interval_count } =
    event.metadata

  return (
    <EventCardBase loading={isLoading}>
      <Link
        href={subscriptionHref(
          organization.slug,
          event.metadata.subscription_id,
        )}
        className="flex grow flex-row items-center justify-between gap-x-12"
      >
        <div className="flex flex-row items-center gap-x-4 p-2">
          <div className="flex flex-row items-center gap-x-4">
            <AllInclusiveOutlined fontSize="inherit" />
            {product ? <span>{product.name}</span> : null}
          </div>
          {typeof amount === 'number' && currency ? (
            <span className="dark:text-polar-500 text-gray-500">
              <AmountLabel
                amount={amount}
                currency={currency}
                interval={
                  recurring_interval as schemas['RecurringInterval'] | undefined
                }
                intervalCount={recurring_interval_count}
              />
            </span>
          ) : null}
        </div>
        <Status status={status[0]} color={status[1]} size="small" />
      </Link>
    </EventCardBase>
  )
}

const SubscriptionProductUpdatedEventCard = ({
  event,
}: {
  event: schemas['SubscriptionProductUpdatedEvent']
}) => {
  const { organization } = useContext(OrganizationContext)
  const { data: oldProduct, isLoading: isLoadingOldProduct } = useProduct(
    event.metadata.old_product_id,
  )
  const { data: newProduct, isLoading: isLoadingNewProduct } = useProduct(
    event.metadata.new_product_id,
  )

  return (
    <EventCardBase loading={isLoadingOldProduct || isLoadingNewProduct}>
      <Link
        href={subscriptionHref(
          organization.slug,
          event.metadata.subscription_id,
        )}
        className="flex grow flex-row items-center justify-between gap-x-12"
      >
        <div className="flex flex-row items-center gap-x-4 p-2">
          <AllInclusiveOutlined fontSize="inherit" />
          <div className="flex flex-row items-center gap-x-2">
            <span>{oldProduct?.name ?? '—'}</span>
            <ArrowForwardOutlined fontSize="inherit" />
            <span>{newProduct?.name ?? '—'}</span>
          </div>
        </div>
        <Status status="Product Updated" color="blue" size="small" />
      </Link>
    </EventCardBase>
  )
}

export const SubscriptionEventCard = ({
  event,
}: SubscriptionEventCardProps) => {
  switch (event.name) {
    case 'subscription.cycled':
      return (
        <SubscriptionBillingEventCard
          event={event}
          status={['Cycled', 'green']}
        />
      )
    case 'subscription.revoked':
      return (
        <SubscriptionBillingEventCard
          event={event}
          status={['Revoked', 'red']}
        />
      )
    case 'subscription.product_updated':
      return <SubscriptionProductUpdatedEventCard event={event} />
  }
}
