'use client'

import { BenefitGrant } from '@/components/Benefit/BenefitGrant'
import {
  useCustomerBenefitGrants,
  useCustomerCancelSubscription,
  useCustomerOrderInvoice,
  useCustomerOrders,
} from '@/hooks/queries'
import { ReceiptOutlined } from '@mui/icons-material'
import { CustomerOrder, CustomerSubscription, PolarAPI } from '@polar-sh/sdk'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import { useCallback, useState } from 'react'
import { SubscriptionDetails } from '../Subscriptions/SubscriptionDetails'

const CustomerPortalSubscription = ({
  api,
  subscription: _subscription,
}: {
  api: PolarAPI
  subscription: CustomerSubscription
}) => {
  const [subscription, setSubscription] = useState(_subscription)
  const { data: benefitGrants } = useCustomerBenefitGrants(api, {
    subscriptionId: subscription.id,
    limit: 100,
    sorting: ['type'],
  })

  const { data: orders } = useCustomerOrders(api, {
    subscriptionId: subscription.id,
    limit: 100,
    sorting: ['-created_at'],
  })

  const orderInvoiceMutation = useCustomerOrderInvoice(api)
  const openInvoice = useCallback(
    async (order: CustomerOrder) => {
      const { url } = await orderInvoiceMutation.mutateAsync({ id: order.id })
      window.open(url, '_blank')
    },
    [orderInvoiceMutation],
  )

  const hasInvoices = orders?.items && orders.items.length > 0

  const cancelSubscription = useCustomerCancelSubscription(api)
  const isCanceled =
    cancelSubscription.isPending ||
    cancelSubscription.isSuccess ||
    !!subscription.ended_at ||
    !!subscription.cancel_at_period_end

  return (
    <>
      <div className="flex h-full flex-col gap-12">
        <div className="flex w-full flex-col gap-8">
          <SubscriptionDetails
            api={api}
            subscription={subscription}
            onUserSubscriptionUpdate={setSubscription}
            cancelSubscription={cancelSubscription}
            isCanceled={isCanceled}
          />

          {(benefitGrants?.items.length ?? 0) > 0 && (
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
          )}
        </div>

        <div className="flex w-full flex-col gap-8">
          {hasInvoices && (
            <div className="flex flex-col gap-y-4">
              <h3 className="font-medium">Invoices</h3>
              <List size="small">
                {orders.items?.map((order) => (
                  <ListItem
                    key={order.id}
                    className="flex flex-row items-center justify-between"
                    size="small"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">
                        <FormattedDateTime
                          datetime={order.created_at}
                          dateStyle="medium"
                          resolution="day"
                        />
                      </span>
                      <span className="dark:text-polar-500 text-sm text-gray-500">
                        {formatCurrencyAndAmount(
                          order.amount,
                          order.currency,
                          0,
                        )}
                      </span>
                    </div>
                    <Button
                      className="h-8 w-8 rounded-full"
                      variant="secondary"
                      onClick={() => openInvoice(order)}
                      loading={orderInvoiceMutation.isPending}
                      disabled={orderInvoiceMutation.isPending}
                    >
                      <ReceiptOutlined fontSize="inherit" />
                    </Button>
                  </ListItem>
                ))}
              </List>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default CustomerPortalSubscription
