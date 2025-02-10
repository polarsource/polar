'use client'

import { BenefitGrant } from '@/components/Benefit/BenefitGrant'
import {
  useCustomerBenefitGrants,
  useCustomerCancelSubscription,
  useCustomerOrderInvoice,
  useCustomerOrders,
} from '@/hooks/queries'
import { ReceiptOutlined } from '@mui/icons-material'
import { Client, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { List, ListItem } from '@polar-sh/ui/components/atoms/List'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { useCallback, useState } from 'react'
import CustomerSubscriptionDetails from '../Subscriptions/CustomerSubscriptionDetails'

const CustomerPortalSubscription = ({
  api,
  subscription: _subscription,
}: {
  api: Client
  subscription: schemas['CustomerSubscription']
}) => {
  const [subscription, setSubscription] = useState(_subscription)
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

  const hasInvoices = orders?.items && orders.items.length > 0

  const cancelSubscription = useCustomerCancelSubscription(api)
  const isCanceled =
    cancelSubscription.isPending ||
    cancelSubscription.isSuccess ||
    !!subscription.ended_at ||
    !!subscription.ends_at

  return (
    <>
      <div className="flex h-full flex-col gap-12">
        <div className="flex w-full flex-col gap-8">
          <CustomerSubscriptionDetails
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
