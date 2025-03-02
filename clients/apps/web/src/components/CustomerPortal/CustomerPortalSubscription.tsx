'use client'

import { BenefitGrant } from '@/components/Benefit/BenefitGrant'
import {
  useCustomerBenefitGrants,
  useCustomerCancelSubscription,
  useCustomerOrderInvoice,
  useCustomerOrders,
} from '@/hooks/queries'
import { Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useCallback } from 'react'
import { useModal } from '../Modal/useModal'
import AmountLabel from '../Shared/AmountLabel'
import { DetailRow } from '../Shared/DetailRow'
import CustomerCancellationModal from '../Subscriptions/CustomerCancellationModal'
import { SubscriptionStatusLabel } from '../Subscriptions/utils'

const CustomerPortalSubscription = ({
  api,
  subscription,
}: {
  api: Client
  subscription: schemas['CustomerSubscription']
}) => {
  const {
    show: showCancelModal,
    hide: hideCancelModal,
    isShown: cancelModalIsShown,
  } = useModal()

  const { data: benefitGrants } = useCustomerBenefitGrants(api, {
    subscription_id: subscription.id,
    limit: 100,
    sorting: ['type'],
  })

  const { data: orders } = useCustomerOrders(api, {
    subscription_id: subscription.id,
    limit: 100,
    sorting: ['-created_at'],
  })

  const orderInvoiceMutation = useCustomerOrderInvoice(api)
  const openInvoice = useCallback(
    async (order: schemas['CustomerOrder']) => {
      const { url } = await orderInvoiceMutation.mutateAsync({ id: order.id })
      window.open(url, '_blank')
    },
    [orderInvoiceMutation],
  )

  const cancelSubscription = useCustomerCancelSubscription(api)

  const hasInvoices = orders?.items && orders.items.length > 0

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-xl">{subscription.product.name}</h3>
      </div>

      <div className="flex flex-col text-sm">
        <DetailRow
          label="Amount"
          value={
            subscription.amount && subscription.currency ? (
              <AmountLabel
                amount={subscription.amount}
                currency={subscription.currency}
                interval={subscription.recurring_interval}
              />
            ) : (
              'Free'
            )
          }
        />
        <DetailRow
          label="Status"
          value={<SubscriptionStatusLabel subscription={subscription} />}
        />
        {subscription.started_at && (
          <DetailRow
            label="Start Date"
            value={
              <span>
                {new Date(subscription.started_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            }
          />
        )}
        {!subscription.ended_at && subscription.current_period_end && (
          <DetailRow
            label={
              subscription.cancel_at_period_end ? 'Expiry Date' : 'Renewal Date'
            }
            value={
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
            }
          />
        )}
        {subscription.ended_at && (
          <DetailRow
            label="Expired"
            value={
              <span>
                {new Date(subscription.ended_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            }
          />
        )}
      </div>

      <Button
        variant="secondary"
        fullWidth
        onClick={showCancelModal}
        aria-label="Cancel subscription"
      >
        Cancel Subscription
      </Button>

      <div className="flex w-full flex-col gap-4">
        <h3 className="text-lg">Benefit Grants</h3>
        {(benefitGrants?.items.length ?? 0) > 0 ? (
          <div className="flex flex-col gap-4">
            <List>
              {benefitGrants?.items.map((benefitGrant) => (
                <ListItem
                  key={benefitGrant.id}
                  className="py-6 hover:bg-transparent dark:hover:bg-transparent"
                >
                  <BenefitGrant api={api} benefitGrant={benefitGrant} />
                </ListItem>
              ))}
            </List>
          </div>
        ) : (
          <div className="dark:border-polar-700 flex flex-col items-center justify-center gap-4 rounded-2xl border border-gray-200 p-6">
            <span className="dark:text-polar-500 text-gray-500">
              This subscription has no benefit grants
            </span>
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-4">
        {hasInvoices && (
          <div className="flex flex-col gap-y-4">
            <h3 className="text-lg">Invoices</h3>
            <DataTable
              data={orders.items ?? []}
              isLoading={false}
              columns={[
                {
                  accessorKey: 'created_at',
                  header: 'Date',
                  cell: ({ row }) => (
                    <FormattedDateTime
                      datetime={row.original.created_at}
                      dateStyle="medium"
                      resolution="day"
                    />
                  ),
                },
                {
                  accessorKey: 'amount',
                  header: 'Amount',
                  cell: ({ row }) => (
                    <span className="dark:text-polar-500 text-sm text-gray-500">
                      {formatCurrencyAndAmount(
                        row.original.amount,
                        row.original.currency,
                        0,
                      )}
                    </span>
                  ),
                },
                {
                  accessorKey: 'id',
                  header: '',
                  cell: ({ row }) => (
                    <span className="flex justify-end">
                      <Button
                        variant="secondary"
                        onClick={() => openInvoice(row.original)}
                        loading={orderInvoiceMutation.isPending}
                        disabled={orderInvoiceMutation.isPending}
                      >
                        <span className="">View Invoice</span>
                      </Button>
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </div>

      <CustomerCancellationModal
        subscription={subscription}
        isShown={cancelModalIsShown}
        hide={hideCancelModal}
        cancelSubscription={cancelSubscription}
      />
    </div>
  )
}

export default CustomerPortalSubscription
