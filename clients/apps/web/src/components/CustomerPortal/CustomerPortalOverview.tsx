import revalidate from '@/app/actions'
import { Client, schemas } from '@polar-sh/client'
import { useCallback } from 'react'
import CustomerSubscriptionDetails from '../Subscriptions/CustomerSubscriptionDetails'

interface CustomerPortalOverviewProps {
  organization: schemas['Organization']
  subscriptions: schemas['CustomerSubscription'][]
  products: schemas['CustomerProduct'][]
  api: Client
}

export const CustomerPortalOverview = ({
  organization,
  subscriptions,
  products,
  api,
}: CustomerPortalOverviewProps) => {
  return (
    <div className="flex flex-col gap-y-8">
      <SubscriptionsOverview
        api={api}
        organization={organization}
        subscriptions={subscriptions}
        products={products}
      />
    </div>
  )
}

interface SubscriptionsOverviewProps {
  organization: schemas['Organization']
  subscriptions: schemas['CustomerSubscription'][]
  products: schemas['CustomerProduct'][]
  api: Client
}

const SubscriptionsOverview = ({
  subscriptions,
  products,
  api,
}: SubscriptionsOverviewProps) => {
  const onSubscriptionUpdate = useCallback(async () => {
    await revalidate(`customer_portal`)
  }, [])

  return (
    <div className="flex flex-col gap-y-4">
      <h3 className="text-2xl">Subscriptions</h3>
      <div className="flex flex-col gap-y-4">
        {subscriptions.map((s) => (
          <CustomerSubscriptionDetails
            key={s.id}
            api={api}
            subscription={s}
            products={products}
            onUserSubscriptionUpdate={onSubscriptionUpdate}
          />
        ))}
      </div>
    </div>
  )
}
