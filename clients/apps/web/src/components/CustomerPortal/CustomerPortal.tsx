'use client'

import { createClientSideAPI } from '@/utils/client'
import { Client, schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Link from 'next/link'
import { parseAsString, useQueryState } from 'nuqs'
import { useEffect, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { SubscriptionStatusLabel } from '../Subscriptions/utils'
import CustomerPortalOrder from './CustomerPortalOrder'
import CustomerPortalSubscription from './CustomerPortalSubscription'

const PortalSectionLayout = ({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) => {
  return (
    <div
      className={twMerge(
        'flex h-screen w-full flex-col overflow-y-auto px-4 py-12 md:w-1/2 md:p-12 lg:p-24',
        className,
      )}
    >
      <div className="flex w-full flex-col gap-y-16 md:max-w-md">
        {children}
      </div>
    </div>
  )
}

export interface CustomerPortalProps {
  organization: schemas['Organization']
  subscriptions: schemas['CustomerSubscription'][]
  orders: schemas['CustomerOrder'][]
  customerSessionToken?: string
}

export const CustomerPortal = ({
  organization,
  subscriptions,
  orders,
  customerSessionToken,
}: CustomerPortalProps) => {
  const [selectedItemId, setSelectedItemId] = useQueryState(
    'id',
    parseAsString.withDefault(''),
  )

  const selectedItem = useMemo(() => {
    return (
      subscriptions.find((s) => s.id === selectedItemId) ||
      orders.find((o) => o.id === selectedItemId)
    )
  }, [selectedItemId, subscriptions, orders])

  const api = createClientSideAPI(customerSessionToken)

  useEffect(() => {
    const firstItemId = subscriptions[0]?.id ?? orders[0]?.id

    if (selectedItemId === '' && firstItemId) {
      setSelectedItemId(firstItemId)
    }
  }, [selectedItemId, subscriptions, orders])

  return (
    <div className="flex h-screen w-screen flex-row">
      <PortalSectionLayout className="dark:bg-polar-900 w-full bg-gray-100 md:items-end">
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
        <div className="flex flex-col gap-y-8">
          {subscriptions.length > 0 && (
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-row items-center justify-between">
                <h3 className="text-lg">Active Subscriptions</h3>
              </div>
              {subscriptions.map((s) => (
                <OrderItem
                  key={s.id}
                  item={s}
                  onClick={() => setSelectedItemId(s.id)}
                  selected={selectedItem?.id === s.id}
                  customerSessionToken={customerSessionToken}
                />
              ))}
            </div>
          )}
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
                    onClick={() => setSelectedItemId(order.id)}
                    selected={selectedItem?.id === order.id}
                    customerSessionToken={customerSessionToken}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </PortalSectionLayout>
      <PortalSectionLayout className="hidden md:flex">
        {selectedItem && <SelectedItemDetails item={selectedItem} api={api} />}
      </PortalSectionLayout>
    </div>
  )
}

const OrderItem = ({
  item,
  onClick,
  selected,
  customerSessionToken,
}: {
  item: schemas['CustomerSubscription'] | schemas['CustomerOrder']
  onClick: () => void
  selected: boolean
  customerSessionToken?: string
}) => {
  const content = (
    <div className="flex flex-row justify-between">
      <div
        className={twMerge(
          'flex flex-col gap-y-1',
          selected ? '' : 'dark:text-polar-500 text-gray-500',
        )}
      >
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
      <div
        className={twMerge(
          className,
          selected && 'dark:bg-polar-700 bg-white',
          'hidden md:flex',
        )}
        onClick={onClick}
      >
        {content}
      </div>
      <Link
        className={twMerge(className, 'flex md:hidden')}
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
  api,
}: {
  item: schemas['CustomerSubscription'] | schemas['CustomerOrder']
  api: Client
}) => {
  // Render order details
  return 'recurring_interval' in item ? (
    <CustomerPortalSubscription api={api} subscription={item} />
  ) : (
    <CustomerPortalOrder api={api} order={item} />
  )
}
