import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import { useSubscription } from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import AllInclusiveOutlined from '@mui/icons-material/AllInclusiveOutlined'
import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import Link from 'next/link'
import { useContext, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
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

  const status = useMemo(() => {
    switch (event.name) {
      case 'subscription.cycled':
        return [
          'Cycled',
          'bg-emerald-100 text-emerald-500 dark:bg-emerald-950 dark:text-emerald-500',
        ]
      case 'subscription.revoked':
        return [
          'Revoked',
          'bg-red-100 text-red-500 dark:bg-red-950 dark:text-red-500',
        ]
      case 'subscription.product_updated':
        return [
          'Product Updated',
          'bg-blue-100 text-blue-500 dark:bg-blue-950 dark:text-blue-500',
        ]
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
              <ProductPriceLabel product={subscription.product} />
            </span>
          </div>
          {status ? (
            <Status
              status={status[0]}
              className={twMerge(status[1], 'text-xs')}
            />
          ) : null}
        </Link>
      ) : null}
    </EventCardBase>
  )
}
