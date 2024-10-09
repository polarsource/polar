'use client'

import AmountLabel from '@/components/Shared/AmountLabel'
import { useOrganization } from '@/hooks/queries'
import { Organization, UserOrder, UserSubscription } from '@polar-sh/sdk'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  DataTable,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { PropsWithChildren, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

export interface CustomerPortalProps {
  organization?: Organization
  subscriptions: UserSubscription[]
  orders: UserOrder[]
}

export const CustomerPortal = ({
  organization,
  subscriptions,
  orders,
}: CustomerPortalProps) => {
  return (
    <ShadowBox className="flex w-full max-w-7xl flex-col items-center gap-12 md:px-32 md:py-24">
      <div className="flex w-full max-w-2xl flex-col gap-y-12">
        {organization && !organization.profile_settings?.enabled && (
          <div className="flex flex-row items-center gap-x-4">
            <Avatar
              className="h-12 w-12"
              avatar_url={organization.avatar_url}
              name={organization.name}
            />
            <h3 className="text-xl">{organization.name}</h3>
          </div>
        )}
        <div className="flex flex-row items-center justify-between">
          <h3 className="text-3xl">Customer Portal</h3>
        </div>

        <div className="flex flex-col gap-y-8">
          {subscriptions.map((s) => (
            <Link
              key={s.id}
              className="flex w-full flex-row items-center justify-between"
              href={`/purchases/subscriptions/${s.id}`}
            >
              <SubscriptionItem subscription={s} />
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
              /*  {
                accessorKey: 'context',
                enableSorting: false,
                header: () => <></>,
                cell: () => {
                  return (
                    <div className="flex flex-row justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="focus:outline-none"
                          asChild
                        >
                          <Button
                            className={
                              'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
                            }
                            size="icon"
                            variant="secondary"
                          >
                            <MoreVertOutlined fontSize="inherit" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="dark:bg-polar-800 bg-gray-50 shadow-lg"
                        >
                          <DropdownMenuItem>View Benefits</DropdownMenuItem>
                          <DropdownMenuItem>Generate Invoice</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                },
              }, */
            ]}
          />
        </div>
      </div>
    </ShadowBox>
  )
}

const StatusWrapper = ({
  children,
  color,
}: PropsWithChildren<{ color: string }>) => {
  return (
    <div className="flex flex-row items-center gap-x-2">
      <span className={twMerge('h-1.5 w-1.5 rounded-full', color)} />
      <span className="capitalize">{children}</span>
    </div>
  )
}

const SubscriptionItem = ({
  subscription,
}: {
  subscription: UserSubscription
}) => {
  const { data: organization } = useOrganization(
    subscription.product.organization_id,
  )

  const status = useMemo(() => {
    switch (subscription?.status) {
      case 'active':
        return (
          <StatusWrapper
            color={
              subscription.cancel_at_period_end
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }
          >
            {subscription.cancel_at_period_end ? 'To be cancelled' : 'Active'}
          </StatusWrapper>
        )
      default:
        return (
          <StatusWrapper color="bg-red-400">
            {subscription?.status.split('_').join(' ')}
          </StatusWrapper>
        )
    }
  }, [subscription])

  return (
    <ShadowBox className="dark:bg-polar-950 bg-gray-75 flex w-full flex-col gap-y-6">
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
        <Link href={`/purchases/subscriptions/${subscription.id}`}>
          <Button size="sm">Manage Subscription</Button>
        </Link>
      </div>
      <div className="dark:divide-polar-700 flex flex-col divide-y divide-gray-100 text-sm">
        <div className="flex flex-row items-center justify-between py-2">
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
        <div className="flex flex-row items-center justify-between py-3">
          <span>Status</span>
          {status}
        </div>
        {subscription?.started_at && (
          <div className="flex flex-row items-center justify-between py-3">
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
          <div className="flex flex-row items-center justify-between py-3">
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
          <div className="flex flex-row items-center justify-between py-3">
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
          <div className="flex flex-row items-center justify-between py-3">
            <span>Benefits</span>
            <span>
              <Link href={`/purchases/subscriptions/${subscription.id}`}>
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
