import revalidate from '@/app/actions'
import { useCustomerOrders } from '@/hooks/queries'
import { Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import CustomerSubscriptionDetails from '../Subscriptions/CustomerSubscriptionDetails'
import CustomerPortalSubscription from './CustomerPortalSubscription'
import { OrderPaymentRetryModal } from './OrderPaymentRetryModal'

interface SubscriptionsOverviewProps {
  organization: schemas['CustomerOrganization']
  subscriptions: schemas['CustomerSubscription'][]
  products: schemas['CustomerProduct'][]
  api: Client
  customerSessionToken: string
}

export const ActiveSubscriptionsOverview = ({
  subscriptions,
  products,
  api,
  customerSessionToken,
}: SubscriptionsOverviewProps) => {
  const onSubscriptionUpdate = useCallback(async () => {
    await revalidate(`customer_portal`)
  }, [])

  return (
    <div className="flex flex-col gap-y-4">
      <h3 className="text-xl">Subscriptions</h3>
      <div className="flex flex-col gap-y-4">
        {subscriptions.length > 0 ? (
          subscriptions.map((s) => (
            <CustomerSubscriptionDetails
              key={s.id}
              api={api}
              subscription={s}
              products={products}
              onUserSubscriptionUpdate={onSubscriptionUpdate}
              customerSessionToken={customerSessionToken}
            />
          ))
        ) : (
          <div className="dark:border-polar-700 flex flex-col items-center justify-center rounded-2xl border border-gray-200 p-12 text-gray-500">
            <p>No Subscriptions Found</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface SubscriptionsOverviewProps {
  organization: schemas['CustomerOrganization']
  subscriptions: schemas['CustomerSubscription'][]
}

export const InactiveSubscriptionsOverview = ({
  organization,
  subscriptions,
  api,
  customerSessionToken,
}: SubscriptionsOverviewProps) => {
  const router = useRouter()
  const theme = useTheme()
  const themingPreset = getThemePreset(
    organization.slug,
    theme.resolvedTheme as 'light' | 'dark',
  )

  const [selectedSubscription, setSelectedSubscription] = useState<
    schemas['CustomerSubscription'] | null
  >(null)
  const [retryPaymentSubscription, setRetryPaymentSubscription] = useState<
    schemas['CustomerSubscription'] | null
  >(null)

  const {
    isShown: isSubscriptionModalOpen,
    hide: _hideSubscriptionModal,
    show: showSubscriptionModal,
  } = useModal()

  const {
    isShown: isRetryPaymentModalOpen,
    hide: _hideRetryPaymentModal,
    show: showRetryPaymentModal,
  } = useModal()

  const openSubscriptionModal = useCallback(
    (subscription: schemas['CustomerSubscription']) => {
      setSelectedSubscription(subscription)
      showSubscriptionModal()
    },
    [showSubscriptionModal],
  )

  const hideSubscriptionModal = useCallback(() => {
    setSelectedSubscription(null)
    _hideSubscriptionModal()
  }, [_hideSubscriptionModal])

  const openRetryPaymentModal = useCallback(
    (subscription: schemas['CustomerSubscription']) => {
      setRetryPaymentSubscription(subscription)
      showRetryPaymentModal()
    },
    [showRetryPaymentModal],
  )

  const hideRetryPaymentModal = useCallback(() => {
    setRetryPaymentSubscription(null)
    _hideRetryPaymentModal()
  }, [_hideRetryPaymentModal])

  const { data: orders } = useCustomerOrders(api, {
    subscription_id: retryPaymentSubscription?.id,
    limit: 10,
    sorting: ['-created_at'],
  })

  const pastDueOrder = useMemo(() => {
    if (
      !retryPaymentSubscription ||
      retryPaymentSubscription.status !== 'past_due' ||
      !orders?.items
    ) {
      return null
    }
    return orders.items.find((order) => order.status === 'pending')
  }, [retryPaymentSubscription, orders?.items])

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between">
        <h3 className="text-xl">Inactive Subscriptions</h3>
      </div>
      <DataTable
        data={subscriptions ?? []}
        isLoading={false}
        columns={[
          {
            accessorKey: 'product.name',
            header: 'Product',
            cell: ({ row }) => row.original.product.name,
          },
          {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => (
              <span className="capitalize">
                {row.original.status.split('_').join(' ')}
              </span>
            ),
          },
          {
            accessorKey: 'ended_at',
            header: 'Ended At',
            cell: ({ row }) =>
              row.original.ended_at ? (
                <FormattedDateTime
                  datetime={row.original.ended_at}
                  dateStyle="medium"
                  resolution="day"
                />
              ) : (
                '—'
              ),
          },
          {
            accessorKey: 'id',
            header: '',
            cell: ({ row }) => (
              <span className="flex justify-end gap-2">
                {row.original.status === 'past_due' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => openRetryPaymentModal(row.original)}
                  >
                    Retry Payment
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openSubscriptionModal(row.original)}
                >
                  View Subscription
                </Button>
              </span>
            ),
          },
        ]}
      />

      <InlineModal
        isShown={isSubscriptionModalOpen}
        hide={hideSubscriptionModal}
        modalContent={
          selectedSubscription ? (
            <div className="flex flex-col overflow-y-auto p-8">
              <CustomerPortalSubscription
                api={api}
                customerSessionToken={customerSessionToken}
                subscription={selectedSubscription}
              />
            </div>
          ) : (
            <></>
          )
        }
      />

      {pastDueOrder && retryPaymentSubscription && (
        <OrderPaymentRetryModal
          order={pastDueOrder}
          api={api}
          isOpen={isRetryPaymentModalOpen}
          onClose={hideRetryPaymentModal}
          onSuccess={async () => {
            hideRetryPaymentModal()
            await revalidate(`customer_portal`)
            router.refresh()
          }}
          themingPreset={themingPreset}
        />
      )}
    </div>
  )
}
