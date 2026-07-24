import revalidate from '@/app/actions'
import { useCustomerOrders } from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { DataTable } from '@polar-sh/orbit'
import { subscriptionStatusDisplayNames } from '../Subscriptions/utils'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { InlineModal } from '@polar-sh/orbit'
import { useModal } from '../Modal/useModal'
import CustomerSubscriptionDetails from './CustomerSubscriptionDetails'
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
    <Box flexDirection="column" rowGap="l">
      <Text variant="heading-xs" as="h3">
        Subscriptions
      </Text>
      <Box flexDirection="column" rowGap="l">
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
          <Box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            borderRadius="l"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            padding="3xl"
          >
            <Text color="muted">No subscriptions found</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export const InactiveSubscriptionsOverview = ({
  subscriptions,
  products,
  api,
  customerSessionToken,
}: SubscriptionsOverviewProps) => {
  const router = useRouter()
  const theme = useTheme()
  const themingPreset = getThemePreset(theme.resolvedTheme as 'light' | 'dark')

  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<
    string | null
  >(null)
  // Derive from the (refreshable) subscriptions prop rather than snapshotting,
  // so a cancellation reflects here after the list refetches.
  const selectedSubscription =
    subscriptions.find((s) => s.id === selectedSubscriptionId) ?? null
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
      setSelectedSubscriptionId(subscription.id)
      showSubscriptionModal()
    },
    [showSubscriptionModal],
  )

  const hideSubscriptionModal = useCallback(() => {
    setSelectedSubscriptionId(null)
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
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="center" justifyContent="between">
        <Text variant="heading-xs" as="h3">
          Inactive subscriptions
        </Text>
      </Box>
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
              <Text as="span">
                {subscriptionStatusDisplayNames[row.original.status]}
              </Text>
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
              <Box justifyContent="end" columnGap="s">
                {row.original.status === 'past_due' && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => openRetryPaymentModal(row.original)}
                  >
                    Retry payment
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openSubscriptionModal(row.original)}
                >
                  Manage subscription
                </Button>
              </Box>
            ),
          },
        ]}
      />

      <InlineModal
        isShown={isSubscriptionModalOpen}
        hide={hideSubscriptionModal}
        modalContent={
          selectedSubscription ? (
            <Box flexDirection="column" overflowY="auto" padding="2xl">
              <CustomerPortalSubscription
                api={api}
                customerSessionToken={customerSessionToken}
                subscription={selectedSubscription}
                products={products}
              />
            </Box>
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
    </Box>
  )
}
