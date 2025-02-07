'use client'

import Pagination from '@/components/Pagination/Pagination'
import { PurchasesQueryParametersContext } from '@/components/Purchases/PurchasesQueryParametersContext'
import PurchaseSidebar from '@/components/Purchases/PurchasesSidebar'
import AmountLabel from '@/components/Shared/AmountLabel'
import { SubscriptionStatusLabel } from '@/components/Subscriptions/utils'
import { useCustomerSubscriptions } from '@/hooks/queries'
import { api } from '@/utils/client'
import { Search, ShoppingBagOutlined } from '@mui/icons-material'
import { components } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useContext } from 'react'

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

  const { data: subscriptions } = useCustomerSubscriptions(api, {
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
      <div className="flex w-full flex-col gap-y-8">
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
              {subscriptions?.items.map((subscription) => (
                <Link
                  key={subscription.id}
                  className="flex w-full flex-row items-center justify-between"
                  href={`/purchases/subscriptions/${subscription.id}`}
                >
                  <SubscriptionItem subscription={subscription} />
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

const SubscriptionItem = ({
  subscription,
}: {
  subscription: components['schemas']['CustomerSubscription']
}) => {
  const organization = subscription.product.organization

  if (!organization) {
    return null
  }

  let nextEventTitle = null
  let nextEventDate = null
  if (!subscription.ended_at) {
    if (subscription.ends_at) {
      nextEventTitle = 'Expiry Date'
      nextEventDate = new Date(subscription.ends_at)
    } else if (subscription.current_period_end) {
      nextEventTitle = 'Renewal Date'
      nextEventDate = new Date(subscription.current_period_end)
    }
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
      <div className="flex flex-col gap-y-2 text-sm">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-500">Amount</span>
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
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-500">Status</span>
          <SubscriptionStatusLabel subscription={subscription} />
        </div>
        {subscription.started_at && (
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              Start Date
            </span>
            <span>
              {new Date(subscription.started_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
        {nextEventTitle && nextEventDate && (
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              {nextEventTitle}
            </span>
            <span>
              {nextEventDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
        {subscription.ended_at && (
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">Expired</span>
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
            <span className="dark:text-polar-500 text-gray-500">Benefits</span>
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
