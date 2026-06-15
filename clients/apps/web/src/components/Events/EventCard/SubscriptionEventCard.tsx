import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { useSubscription } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import { schemas } from '@polar-sh/client'
import { Status, type StatusColor } from '@polar-sh/orbit'
import Link from 'next/link'
import { useContext, useMemo } from 'react'
import { EventCardBase } from './EventCardBase'

export interface SubscriptionEventCardProps {
  event:
    | schemas['SubscriptionCycledEvent']
    | schemas['SubscriptionRevokedEvent']
    | schemas['SubscriptionProductUpdatedEvent']
}

export const SubscriptionEventCard = ({
  event,
}: SubscriptionEventCardProps) => {
  const { organization } = useContext(OrganizationContext)
  const { data: subscription, isLoading: isLoadingSubscription } =
    useSubscription(event.metadata.subscription_id)

  const status = useMemo((): [string, StatusColor] | null => {
    switch (event.name) {
      case 'subscription.cycled':
        return ['Cycled', 'green']
      case 'subscription.revoked':
        return ['Revoked', 'red']
      case 'subscription.product_updated':
        return ['Product Updated', 'blue']
      default:
        return null
    }
  }, [event.name])

  return (
    <EventCardBase loading={isLoadingSubscription}>
      {subscription ? (
        <Link
          href={`/dashboard/${organization.slug}/subscriptions?subscriptionId=${subscription.id}`}
          className="flex grow flex-row items-center justify-between gap-x-12"
        >
          <div className="flex flex-row items-center gap-x-4 p-2">
            <div className="flex flex-row items-center gap-x-4">
              <AllInclusiveOutlined fontSize="inherit" />
              <span className="">{subscription.product.name}</span>
            </div>
            <span className="dark:text-polar-500 text-gray-500">
              <ProductPriceLabel
                product={subscription.product}
                currency={subscription.currency}
              />
            </span>
          </div>
          {status ? (
            <Status status={status[0]} color={status[1]} size="small" />
          ) : null}
        </Link>
      ) : null}
    </EventCardBase>
  )
}
