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
  const multipleSubscriptions =
    organization.subscription_settings.allow_multiple_subscriptions

  const activeSubscription = subscriptions.find((s) => s.status === 'active')

  return (
    <div className="flex flex-col gap-y-8">
      {multipleSubscriptions ? (
        <MultipleSubscriptionOverview
          api={api}
          organization={organization}
          subscriptions={subscriptions}
          products={products}
        />
      ) : (
        <SingleSubscriptionOverview
          api={api}
          organization={organization}
          subscription={activeSubscription}
          products={products}
        />
      )}
    </div>
  )
}

interface SingleSubscriptionOverviewProps {
  organization: schemas['Organization']
  subscription?: schemas['CustomerSubscription']
  api: Client
  products: schemas['CustomerProduct'][]
}

const SingleSubscriptionOverview = ({
  subscription,
  api,
  products,
}: SingleSubscriptionOverviewProps) => {
  const onSubscriptionUpdate = useCallback(async () => {
    await revalidate(`customer_portal`)
  }, [])

  return (
    <div className="flex flex-col gap-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {subscription ? (
          <CustomerSubscriptionDetails
            api={api}
            subscription={subscription}
            products={products}
            onUserSubscriptionUpdate={onSubscriptionUpdate}
          />
        ) : (
          <div className="dark:bg-polar-800 flex h-full flex-col items-center justify-center gap-4 rounded-2xl bg-gray-100 p-8 text-center">
            <p className="dark:text-polar-500 text-gray-500">
              No active subscription
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface MultipleSubscriptionOverviewProps {
  organization: schemas['Organization']
  subscriptions: schemas['CustomerSubscription'][]
  products: schemas['CustomerProduct'][]
  api: Client
}

const MultipleSubscriptionOverview = ({
  organization,
  subscriptions,
  products,
  api,
}: MultipleSubscriptionOverviewProps) => {
  const onSubscriptionUpdate = useCallback(async () => {
    await revalidate(`customer_portal`)
  }, [])

  return (
    <div className="flex flex-col gap-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
