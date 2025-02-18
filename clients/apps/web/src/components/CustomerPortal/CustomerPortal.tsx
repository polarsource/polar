'use client'

import { createClientSideAPI } from '@/utils/client'
import { Client, schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { SubscriptionStatusLabel } from '../Subscriptions/utils'
import CustomerPortalOrder from './CustomerPortalOrder'
import { CustomerPortalOverview } from './CustomerPortalOverview'
import CustomerPortalSubscription from './CustomerPortalSubscription'

export interface CustomerPortalProps {
  organization: schemas['Organization']
  products: schemas['CustomerProduct'][]
  subscriptions: schemas['CustomerSubscription'][]
  orders: schemas['CustomerOrder'][]
  customerSessionToken?: string
}

export const CustomerPortal = ({
  organization,
  products,
  subscriptions,
  orders,
  customerSessionToken,
}: CustomerPortalProps) => {
  const api = createClientSideAPI(customerSessionToken)

  return (
    <div className="flex flex-col gap-y-16 py-12">
      <div className="flex flex-row items-center gap-x-4">
        <Avatar
          className="h-12 w-12"
          avatar_url={organization.avatar_url}
          name={organization.name}
        />
        <h3 className="text-lg">{organization.name}</h3>
      </div>
      <div>
        <h2 className="text-4xl">Customer Portal</h2>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <CustomerPortalOverview
            api={api}
            organization={organization}
            products={products}
            subscriptions={subscriptions}
          />
        </TabsContent>
        <TabsContent value="subscriptions">
          <div className="flex flex-col gap-y-8">
            {subscriptions.map((s) => (
              <OrderItem
                key={s.id}
                item={s}
                customerSessionToken={customerSessionToken}
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="orders">
          {orders.length > 0 && (
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-row items-center justify-between">
                <h3 className="text-lg">Orders</h3>
              </div>
              <div className="flex flex-col gap-y-4">
                {orders.map((order) => (
                  <OrderItem
                    key={order.id}
                    item={order}
                    customerSessionToken={customerSessionToken}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

const OrderItem = ({
  item,
  customerSessionToken,
}: {
  item: schemas['CustomerSubscription'] | schemas['CustomerOrder']
  customerSessionToken?: string
}) => {
  const content = (
    <div className="flex flex-row justify-between">
      <div className="flex flex-col gap-y-1">
        <h4 className="text-lg">{item.product.name}</h4>
        {'recurring_interval' in item ? (
          <SubscriptionStatusLabel className="text-sm" subscription={item} />
        ) : (
          <p className="text-sm text-gray-500">
            {new Date(item.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        )}
      </div>
    </div>
  )

  const className =
    'dark:bg-polar-800 dark:hover:bg-polar-700 w-full cursor-pointer rounded-2xl bg-gray-200 px-6 py-4 hover:bg-white transition-colors duration-75'

  return (
    <>
      <Link
        className={twMerge(className, 'flex')}
        href={`/${item.product.organization.slug}/portal/${
          'recurring_interval' in item ? 'subscriptions' : 'orders'
        }/${item.id}?customer_session_token=${customerSessionToken}`}
      >
        {content}
      </Link>
    </>
  )
}

const SelectedItemDetails = ({
  item,
  products,
  api,
}: {
  item: schemas['CustomerSubscription'] | schemas['CustomerOrder']
  products: schemas['CustomerProduct'][]
  api: Client
}) => {
  // Render order details
  return 'recurring_interval' in item ? (
    <CustomerPortalSubscription
      api={api}
      subscription={item}
      products={products}
    />
  ) : (
    <CustomerPortalOrder api={api} order={item} />
  )
}
