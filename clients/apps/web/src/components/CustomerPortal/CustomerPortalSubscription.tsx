'use client'

import { BenefitGrant } from '@/components/Benefit/BenefitGrant'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import AmountLabel from '@/components/Shared/AmountLabel'
import ChangePlanModal from '@/components/Subscriptions/ChangePlanModal'
import {
  useCustomerBenefitGrants,
  useCustomerCancelSubscription,
  useCustomerOrderInvoice,
  useCustomerOrders,
} from '@/hooks/queries'
import { markdownOptions } from '@/utils/markdown'
import { ReceiptOutlined } from '@mui/icons-material'
import { CustomerOrder, CustomerSubscription, PolarAPI } from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import { useCallback, useState } from 'react'

const CustomerPortalSubscription = ({
  api,
  subscription: _subscription,
}: {
  api: PolarAPI
  subscription: CustomerSubscription
}) => {
  const [subscription, setSubscription] = useState(_subscription)
  const organization = subscription.product.organization
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

  const [showChangePlanModal, setShowChangePlanModal] = useState(false)

  const cancelSubscription = useCustomerCancelSubscription(api)
  const isCanceled =
    cancelSubscription.isPending ||
    cancelSubscription.isSuccess ||
    subscription.ended_at ||
    subscription.cancel_at_period_end
  const [showCancelModal, setShowCancelModal] = useState(false)

  return (
    <>
      <div className="flex h-full flex-grow flex-col-reverse gap-12 md:flex-row md:items-start">
        <div className="flex w-full flex-col gap-8">
          <ShadowBox className="flex flex-col gap-6">
            <Link
              className="flex flex-row items-center gap-x-4"
              href={`/${organization.slug}`}
            >
              <Avatar
                className="h-12 w-12"
                avatar_url={organization.avatar_url}
                name={organization.name}
              />
              <h3 className="text-lg">{organization.name}</h3>
            </Link>
            <h1 className="text-3xl font-medium">
              {subscription.product.name}
            </h1>
            {subscription.product.description ? (
              <div className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-md prose-h6:text-sm dark:prose-headings:text-polar-50 dark:text-polar-300 max-w-4xl text-gray-800">
                <Markdown options={markdownOptions}>
                  {subscription.product.description}
                </Markdown>
              </div>
            ) : (
              <></>
            )}
          </ShadowBox>
          {(benefitGrants?.items.length ?? 0) > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-medium">Benefits</h3>
              <List>
                {benefitGrants?.items.map((benefitGrant) => (
                  <ListItem
                    key={benefitGrant.id}
                    className="hover:bg-transparent dark:hover:bg-transparent"
                  >
                    <BenefitGrant api={api} benefitGrant={benefitGrant} />
                  </ListItem>
                ))}
              </List>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-8 md:max-w-[340px]">
          <ShadowBox className="flex flex-col gap-8">
            <h3 className="text-lg font-medium">{subscription.product.name}</h3>
            <div className="flex flex-col gap-4">
              <h1 className="text-4xl font-light">
                {subscription.amount && subscription.currency && (
                  <AmountLabel
                    amount={subscription.amount}
                    currency={subscription.currency}
                    interval={subscription.recurring_interval}
                  />
                )}
              </h1>
              {!isCanceled && subscription.started_at && (
                <p className="dark:text-polar-500 text-sm text-gray-400">
                  Subscribed since{' '}
                  {new Date(subscription.started_at).toLocaleDateString(
                    'en-US',
                    {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    },
                  )}
                </p>
              )}
              {isCanceled &&
                !subscription.ended_at &&
                subscription.cancel_at_period_end &&
                subscription.current_period_end && (
                  <p className="dark:text-polar-500 text-sm text-gray-400">
                    Will be canceled at{' '}
                    {new Date(
                      subscription.current_period_end,
                    ).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                )}
              {isCanceled && subscription.ended_at && (
                <p className="dark:text-polar-500 text-sm text-gray-400">
                  Canceled since{' '}
                  {new Date(subscription.ended_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {!isCanceled && (
                <Button
                  size="lg"
                  fullWidth
                  onClick={() => setShowChangePlanModal(true)}
                >
                  Change Plan
                </Button>
              )}
              {!isCanceled && (
                <Button
                  size="lg"
                  variant="ghost"
                  fullWidth
                  onClick={() => setShowCancelModal(true)}
                >
                  Unsubscribe
                </Button>
              )}
              <ConfirmModal
                isShown={showCancelModal}
                hide={() => setShowCancelModal(false)}
                title={`Unsubscribe from ${subscription.product.name}?`}
                description={
                  "At the end of your billing period, you won't have access to your benefits anymore."
                }
                destructiveText="Unsubscribe"
                onConfirm={() =>
                  cancelSubscription.mutateAsync({ id: subscription.id })
                }
                destructive
              />
            </div>
          </ShadowBox>
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
      <InlineModal
        isShown={showChangePlanModal}
        hide={() => setShowChangePlanModal(false)}
        modalContent={
          <ChangePlanModal
            api={api}
            organization={organization}
            subscription={subscription}
            hide={() => setShowChangePlanModal(false)}
            onUserSubscriptionUpdate={setSubscription}
          />
        }
      />
    </>
  )
}

export default CustomerPortalSubscription
