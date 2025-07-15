import revalidate from '@/app/actions'
import { Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useThemePreset } from '@polar-sh/ui/hooks/theming'
import { useCallback, useState } from 'react'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import CustomerSubscriptionDetails from '../Subscriptions/CustomerSubscriptionDetails'
import CustomerPortalSubscription from './CustomerPortalSubscription'

interface SubscriptionsOverviewProps {
  organization: schemas['Organization']
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
  organization: schemas['Organization']
  subscriptions: schemas['CustomerSubscription'][]
}

export const InactiveSubscriptionsOverview = ({
  organization,
  subscriptions,
  api,
  customerSessionToken,
}: SubscriptionsOverviewProps) => {
  const themingPreset = useThemePreset(
    organization.slug === 'midday' ? 'midday' : 'polar',
  )

  const [selectedSubscription, setSelectedSubscription] = useState<
    schemas['CustomerSubscription'] | null
  >(null)

  const {
    isShown: isSubscriptionModalOpen,
    hide: _hideSubscriptionModal,
    show: showSubscriptionModal,
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

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between">
        <h3 className="text-xl">Inactive Subscriptions</h3>
      </div>
      <DataTable
        wrapperClassName={themingPreset.polar.table}
        headerClassName={themingPreset.polar.tableHeader}
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
            cell: ({ row }) => (
              <FormattedDateTime
                datetime={row.original.ended_at ?? '—'}
                dateStyle="medium"
                resolution="day"
              />
            ),
          },
          {
            accessorKey: 'id',
            header: '',
            cell: ({ row }) => (
              <span className="flex justify-end">
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
                themingPreset={themingPreset}
              />
            </div>
          ) : (
            <></>
          )
        }
      />
    </div>
  )
}
