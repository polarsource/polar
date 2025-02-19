import revalidate from '@/app/actions'
import { Client, schemas } from '@polar-sh/client'
import { useCallback } from 'react'
import CustomerSubscriptionDetails from '../Subscriptions/CustomerSubscriptionDetails'
import { CustomerUsage } from './CustomerUsage'

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

      <div className="dark:bg-polar-900 rounded-xl bg-white">
        <div className="flex flex-col">
          <div className="dark:border-polar-700 flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-medium">Overview</h2>
            <div className="flex items-center gap-2">
              <span className="dark:text-polar-500 text-sm text-gray-500">
                Current Billing Cycle
              </span>
              <span className="text-sm">Jan 27, 9:00 - Feb 27, 9:00</span>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-[1fr,100px,100px,100px] gap-4">
              <div className="dark:text-polar-500 text-sm text-gray-500">
                Product
              </div>
              <div className="dark:text-polar-500 text-sm text-gray-500">
                Included
              </div>
              <div className="dark:text-polar-500 text-sm text-gray-500">
                On-demand
              </div>
              <div className="dark:text-polar-500 text-sm text-gray-500">
                Charge
              </div>

              {[
                {
                  name: 'Observability Events',
                  included: '1M / 1M',
                  onDemand: '~15M',
                  charge: '$13.25',
                },
                {
                  name: 'Edge Middleware Invocations',
                  included: '1M / 1M',
                  onDemand: '~2.7M',
                  charge: '$2.60',
                },
                {
                  name: 'Function Invocations',
                  included: '1M / 1M',
                  onDemand: '~2.3M',
                  charge: '$1.80',
                },
                {
                  name: 'Edge Function Execution Units',
                  included: '125k / 1M',
                  onDemand: '$0',
                  charge: '$0',
                },
                {
                  name: 'Edge Requests',
                  included: '10M / 1M',
                  onDemand: '$0',
                  charge: '$0',
                },
              ].map((item) => (
                <div key={item.name}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>{item.name}</span>
                  </div>
                  <div>{item.included}</div>
                  <div>{item.onDemand}</div>
                  <div className="text-green-500">{item.charge}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CustomerUsage organizationId={organization.id} />
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
          <div className="dark:bg-polar-800 flex h-full min-h-72 flex-col items-center justify-center gap-4 rounded-2xl bg-gray-100 p-8 text-center">
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
