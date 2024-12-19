'use client'

import AmountLabel from '@/components/Shared/AmountLabel'
import {
  CustomerOrder,
  CustomerSubscription,
  Organization,
} from '@polar-sh/sdk'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  DataTable,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { SubscriptionStatusLabel } from '../Subscriptions/utils'

export interface CustomerPortalProps {
  organization: Organization
  subscriptions: CustomerSubscription[]
  orders: CustomerOrder[]
  customerSessionToken?: string
}

export const CustomerPortal = ({
  organization,
  subscriptions,
  orders,
  customerSessionToken,
}: CustomerPortalProps) => {
  return (
    <div className="flex w-full max-w-7xl flex-col items-center gap-12">
      <div className="flex w-full max-w-2xl flex-col gap-y-12">
        <div className="flex flex-col gap-y-6">
          {subscriptions.map((s) => (
            <Link
              key={s.id}
              className="flex w-full flex-row items-center justify-between"
              href={{
                pathname: `/${organization.slug}/portal/subscriptions/${s.id}`,
                query: { customer_session_token: customerSessionToken },
              }}
            >
              <SubscriptionItem
                subscription={s}
                customerSessionToken={customerSessionToken}
              />
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-row items-center justify-between">
            <h3 className="text-xl">Order History</h3>
          </div>
          <DataTable
            data={orders}
            isLoading={false}
            columns={[
              {
                accessorKey: 'purchaseDate',
                enableSorting: false,
                header: ({ column }) => (
                  <DataTableColumnHeader
                    column={column}
                    title="Purchase Date"
                  />
                ),
                cell: ({ row }) => {
                  return (
                    <div>
                      {new Date(row.original.created_at).toLocaleDateString(
                        'en-US',
                        {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        },
                      )}
                    </div>
                  )
                },
              },
              {
                accessorKey: 'productName',
                enableSorting: false,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Product" />
                ),
                cell: ({ row }) => {
                  return (
                    <div className="flex flex-row">
                      {row.original.product.name}
                    </div>
                  )
                },
              },
              {
                accessorKey: 'productName',
                enableSorting: false,
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Amount" />
                ),
                cell: ({ row }) => {
                  return (
                    <div>
                      {row.original.amount && row.original.currency ? (
                        <AmountLabel
                          amount={row.original.amount}
                          currency={row.original.currency}
                        />
                      ) : (
                        'Unknown'
                      )}
                    </div>
                  )
                },
              },
              {
                accessorKey: 'context',
                enableSorting: false,
                header: ({ column }) => (
                  <DataTableColumnHeader
                    className="flex flex-row justify-end"
                    column={column}
                    title="Actions"
                  />
                ),
                cell: ({ row }) => {
                  const {
                    id,
                    product: { is_recurring },
                    subscription_id,
                  } = row.original
                  return (
                    <div className="flex flex-row justify-end">
                      <Link
                        href={{
                          pathname: is_recurring
                            ? `/${organization.slug}/portal/subscriptions/${subscription_id}`
                            : `/${organization.slug}/portal/orders/${id}`,
                          query: {
                            customer_session_token: customerSessionToken,
                          },
                        }}
                      >
                        <Button size="sm" variant="secondary">
                          View Order
                        </Button>
                      </Link>
                    </div>
                  )
                },
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

const SubscriptionItem = ({
  subscription,
  customerSessionToken,
}: {
  subscription: CustomerSubscription
  customerSessionToken?: string
}) => {
  const organization = subscription.product.organization

  return (
    <ShadowBox className="dark:bg-polar-950 flex w-full flex-col gap-y-6 bg-gray-100">
      <div className="flex flex-row items-start justify-between">
        <div className="flex flex-col gap-y-4">
          <h3 className="truncate text-2xl">{subscription.product.name}</h3>
          {organization && (
            <div className="flex flex-row items-center gap-x-3">
              <Avatar
                className="h-8 w-8"
                avatar_url={organization.avatar_url}
                name={organization.name}
              />
              <p className="dark:text-polar-500 text-sm text-gray-500">
                {organization.name}
              </p>
            </div>
          )}
        </div>
        <Link
          href={{
            pathname: `/${organization.slug}/portal/subscriptions/${subscription.id}`,
            query: { customer_session_token: customerSessionToken },
          }}
        >
          <Button size="sm">Manage Subscription</Button>
        </Link>
      </div>
      <div className="dark:divide-polar-700 flex flex-col gap-y-2 text-sm">
        <div className="flex flex-row items-center justify-between">
          <span>Amount</span>
          {subscription.amount && subscription.currency ? (
            <AmountLabel
              amount={subscription.amount}
              currency={subscription.currency}
              interval={subscription?.recurring_interval}
            />
          ) : (
            'Free'
          )}
        </div>
        <div className="flex flex-row items-center justify-between">
          <span>Status</span>
          <SubscriptionStatusLabel subscription={subscription} />
        </div>
        {subscription?.started_at && (
          <div className="flex flex-row items-center justify-between">
            <span>Start Date</span>
            <span>
              {new Date(subscription.started_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
        {!subscription?.ended_at && subscription?.current_period_end && (
          <div className="flex flex-row items-center justify-between">
            <span>
              {subscription.cancel_at_period_end
                ? 'Expiry Date'
                : 'Renewal Date'}
            </span>
            <span>
              {new Date(subscription.current_period_end).toLocaleDateString(
                'en-US',
                {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                },
              )}
            </span>
          </div>
        )}
        {subscription?.ended_at && (
          <div className="flex flex-row items-center justify-between">
            <span>Expired</span>
            <span>
              {new Date(subscription.ended_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
        {subscription.product.benefits.length > 0 && (
          <div className="flex flex-row items-center justify-between">
            <span>Benefits</span>
            <span>
              <Link
                href={{
                  pathname: `/${organization.slug}/portal/subscriptions/${subscription.id}`,
                  query: { customer_session_token: customerSessionToken },
                }}
              >
                <Button size="sm" variant="secondary">
                  View Benefits
                </Button>
              </Link>
            </span>
          </div>
        )}
      </div>
    </ShadowBox>
  )
}
