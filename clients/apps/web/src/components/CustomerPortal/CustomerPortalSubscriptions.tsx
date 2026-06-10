import revalidate from '@/app/actions'
import { useCustomerOrders } from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { DataTable } from '@polar-sh/orbit'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import CustomerSubscriptionDetails from './CustomerSubscriptionDetails'
import CustomerPortalSubscription from './CustomerPortalSubscription'
import { OrderPaymentRetryModal } from './OrderPaymentRetryModal'
import { useTranslations } from './PortalLocaleProvider'

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
  const t = useTranslations()
  const onSubscriptionUpdate = useCallback(async () => {
    await revalidate(`customer_portal`)
  }, [])

  return (
    <div className="flex flex-col gap-y-4">
      <h3 className="text-xl">{t('portal.overview.subscriptions.title')}</h3>
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
            <p>{t('portal.overview.subscriptions.noSubscriptionsFound')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface SubscriptionsOverviewProps {
  organization: schemas['CustomerOrganization']
  subscriptions: schemas['CustomerSubscription'][]
  products: schemas['CustomerProduct'][]
}

export const InactiveSubscriptionsOverview = ({
  subscriptions,
  products,
  api,
  customerSessionToken,
}: SubscriptionsOverviewProps) => {
  const t = useTranslations()
  const router = useRouter()
  const theme = useTheme()
  const themingPreset = getThemePreset(theme.resolvedTheme as 'light' | 'dark')

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

  const orderItems = orders?.items
  const pastDueOrder = useMemo(() => {
    if (
      !retryPaymentSubscription ||
      retryPaymentSubscription.status !== 'past_due' ||
      !orderItems
    ) {
      return null
    }
    return orderItems.find((order) => order.status === 'pending')
  }, [retryPaymentSubscription, orderItems])

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between">
        <h3 className="text-xl">
          {t('portal.overview.subscriptions.inactiveTitle')}
        </h3>
      </div>
      <DataTable
        data={subscriptions ?? []}
        isLoading={false}
        columns={[
          {
            accessorKey: 'product.name',
            header: t('portal.common.product'),
            cell: ({ row }) => row.original.product.name,
          },
          {
            accessorKey: 'status',
            header: t('portal.common.status'),
            cell: ({ row }) => (
              <span className="capitalize">
                {row.original.status.split('_').join(' ')}
              </span>
            ),
          },
          {
            accessorKey: 'ended_at',
            header: t('portal.overview.subscriptions.endedAt'),
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
                    {t('portal.overview.subscriptions.retryPayment')}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openSubscriptionModal(row.original)}
                >
                  {t('portal.overview.subscriptions.manageSubscription')}
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
                products={products}
              />
            </div>
          ) : null
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
