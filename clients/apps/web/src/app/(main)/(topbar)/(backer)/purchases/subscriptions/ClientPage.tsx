'use client'

import Pagination from '@/components/Pagination/Pagination'
import { PurchasesQueryParametersContext } from '@/components/Purchases/PurchasesQueryParametersContext'
import PurchaseSidebar from '@/components/Purchases/PurchasesSidebar'
import AmountLabel from '@/components/Shared/AmountLabel'
import { useOrganization, useUserSubscriptions } from '@/hooks/queries'
import { Search, ShoppingBagOutlined } from '@mui/icons-material'
import { UserSubscription } from '@polar-sh/sdk'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Switch } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { PropsWithChildren, useCallback, useContext, useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

export default function ClientPage() {
  const searchParams = useSearchParams()
  const [purchaseParameters, setPurchaseParameters] = useContext(
    PurchasesQueryParametersContext,
  )

  const onPageChange = useCallback(
    (page: number) => {
      setPurchaseParameters((prev) => ({
        ...prev,
        page,
      }))
    },
    [setPurchaseParameters],
  )

  const { data: subscriptions } = useUserSubscriptions({
    active: purchaseParameters.inactive ? undefined : true,
    query: purchaseParameters.query,
    limit: purchaseParameters.limit,
    page: purchaseParameters.page,
  })

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPurchaseParameters((prev) => ({
        ...prev,
        query: e.target.value,
      }))
    },
    [setPurchaseParameters],
  )

  return (
    <div className="flex h-full flex-col gap-12 md:flex-row">
      <div className="flex h-full w-full flex-shrink-0 flex-col gap-y-12 self-stretch md:sticky md:top-[3rem] md:max-w-xs">
        <PurchaseSidebar>
          <div className="flex flex-row items-center justify-between gap-x-2">
            <span className="text-sm">Show cancelled</span>
            <Switch
              id="inactive"
              checked={purchaseParameters.inactive}
              onCheckedChange={(e) => {
                setPurchaseParameters((prev) => ({
                  ...prev,
                  inactive: e ? true : false,
                }))
              }}
            />
          </div>
        </PurchaseSidebar>
      </div>
      <div className="dark:bg-polar-900 dark:border-polar-700 rounded-4xl relative flex w-full flex-col items-center gap-y-8 border border-gray-200 bg-gray-50 p-12">
        <div className="flex w-full flex-col gap-y-6">
          <div className="flex flex-row items-center justify-between">
            <h3 className="text-2xl">Subscriptions</h3>
            <div className="w-full max-w-64">
              <Input
                preSlot={<Search fontSize="small" />}
                placeholder="Search Subscriptions"
                onChange={handleSearch}
                value={purchaseParameters.query}
              />
            </div>
          </div>
          {subscriptions?.pagination.total_count === 0 ? (
            <div className="flex h-full w-full flex-col items-center gap-y-4 py-32 text-6xl">
              <ShoppingBagOutlined
                className="dark:text-polar-600 text-gray-400"
                fontSize="inherit"
              />
              <div className="flex flex-col items-center gap-y-2">
                <h3 className="p-2 text-xl font-medium">
                  No subscriptions found
                </h3>
              </div>
            </div>
          ) : (
            <>
              {subscriptions?.items.map((order) => (
                <Link
                  key={order.id}
                  className="flex w-full flex-row items-center justify-between"
                  href={`/purchases/subscriptions/${order.id}`}
                >
                  <SubscriptionItem subscription={order} />
                </Link>
              ))}
              <Pagination
                currentPage={purchaseParameters.page}
                totalCount={subscriptions?.pagination.total_count || 0}
                pageSize={purchaseParameters.limit}
                onPageChange={onPageChange}
                currentURL={searchParams}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const StatusWrapper = ({
  children,
  color,
}: PropsWithChildren<{ color: string }>) => {
  return (
    <div className="flex flex-row items-center gap-x-2">
      <span className={twMerge('h-2 w-2 rounded-full', color)} />
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
    switch (subscription.status) {
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
            {subscription.status.split('_').join(' ')}
          </StatusWrapper>
        )
    }
  }, [subscription])

  if (!organization) {
    return null
  }

  return (
    <ShadowBox className="flex w-full flex-col gap-y-6">
      <div className="flex flex-row items-start justify-between">
        <div className="flex flex-col gap-y-4">
          <h3 className="truncate text-2xl">{subscription.product.name}</h3>
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
        </div>
        <Link href={`/purchases/subscriptions/${subscription.id}`}>
          <Button size="sm">Manage Subscription</Button>
        </Link>
      </div>
      <div className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200 text-sm">
        <div className="flex flex-row items-center justify-between py-2">
          <span>Amount</span>
          {subscription.amount && subscription.currency ? (
            <AmountLabel
              amount={subscription.amount}
              currency={subscription.currency}
              interval={subscription.recurring_interval}
            />
          ) : (
            'Free'
          )}
        </div>
        <div className="flex flex-row items-center justify-between py-3">
          <span>Status</span>
          {status}
        </div>
        {subscription.started_at && (
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
        {!subscription.ended_at && subscription.current_period_end && (
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
        {subscription.ended_at && (
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
