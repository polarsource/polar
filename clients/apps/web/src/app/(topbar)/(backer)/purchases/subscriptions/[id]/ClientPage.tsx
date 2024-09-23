'use client'

import BenefitDetails from '@/components/Benefit/BenefitDetails'
import { BenefitRow } from '@/components/Benefit/BenefitRow'
import { markdownOpts } from '@/components/Feed/Markdown/markdown'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import { Slideshow } from '@/components/Products/Slideshow'
import AmountLabel from '@/components/Shared/AmountLabel'
import ChangePlanModal from '@/components/Subscriptions/ChangePlanModal'
import {
  useCancelSubscription,
  useOrganization,
  useUserBenefits,
  useUserOrderInvoice,
  useUserOrders,
} from '@/hooks/queries'
import { ArrowBackOutlined, ReceiptOutlined } from '@mui/icons-material'
import { UserBenefit, UserOrder, UserSubscription } from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import { useCallback, useState } from 'react'

const ClientPage = ({
  subscription: _subscription,
}: {
  subscription: UserSubscription
}) => {
  const [subscription, setSubscription] = useState(_subscription)
  const { data: organization } = useOrganization(
    subscription.product.organization_id,
  )
  const { data: benefits } = useUserBenefits({
    subscriptionId: subscription.id,
    limit: 100,
    sorting: ['type'],
  })

  const [selectedBenefit, setSelectedBenefit] = useState<UserBenefit | null>(
    null,
  )

  const { data: orders } = useUserOrders({
    subscriptionId: subscription.id,
    limit: 100,
    sorting: ['-created_at'],
  })

  const orderInvoiceMutation = useUserOrderInvoice()
  const openInvoice = useCallback(
    async (order: UserOrder) => {
      const { url } = await orderInvoiceMutation.mutateAsync(order.id)
      window.open(url, '_blank')
    },
    [orderInvoiceMutation],
  )

  const hasInvoices = orders?.items && orders.items.length > 0

  const [showChangePlanModal, setShowChangePlanModal] = useState(false)

  const cancelSubscription = useCancelSubscription(subscription.id)
  const isCanceled =
    cancelSubscription.isPending ||
    cancelSubscription.isSuccess ||
    subscription.ended_at ||
    subscription.cancel_at_period_end
  const [showCancelModal, setShowCancelModal] = useState(false)

  return (
    <div className="flex flex-col gap-y-8">
      <Link
        className="flex flex-row items-center gap-2 self-start text-sm text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
        href={`/purchases/subscriptions`}
      >
        <ArrowBackOutlined fontSize="inherit" />
        <span>Back to Purchases</span>
      </Link>
      <div className="flex h-full flex-grow flex-col-reverse gap-12 md:flex-row md:items-start">
        <div className="flex w-full flex-col gap-8 md:w-2/3">
          <ShadowBox className="flex flex-col gap-6 p-12 ring-gray-100">
            <h1 className="text-3xl">{subscription.product.name}</h1>
            {subscription.product.medias.length > 0 && (
              <Slideshow
                images={subscription.product.medias.map(
                  ({ public_url }) => public_url,
                )}
              />
            )}
            {subscription.product.description ? (
              <div className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-md prose-h6:text-sm dark:prose-headings:text-polar-50 dark:text-polar-300 max-w-4xl text-gray-800">
                <Markdown
                  options={{
                    ...markdownOpts,
                    overrides: {
                      ...markdownOpts.overrides,
                      a: (props) => (
                        <a {...props} rel="noopener noreferrer nofollow" />
                      ),
                    },
                  }}
                >
                  {subscription.product.description}
                </Markdown>
              </div>
            ) : (
              <></>
            )}
          </ShadowBox>
          {benefits?.items && (
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-medium">Benefits</h3>
              <List>
                {benefits.items.map((benefit) => (
                  <ListItem
                    key={benefit.id}
                    selected={benefit.id === selectedBenefit?.id}
                    onSelect={() => setSelectedBenefit(benefit)}
                  >
                    <BenefitRow benefit={benefit} subscription={subscription} />
                  </ListItem>
                ))}
              </List>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-8 md:max-w-[340px]">
          <ShadowBox className="flex flex-col gap-8 md:ring-gray-100">
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
              <Button
                size="lg"
                fullWidth
                onClick={() => setShowChangePlanModal(true)}
              >
                Change Plan
              </Button>
              {!isCanceled && (
                <Button
                  size="lg"
                  variant="ghost"
                  className="dark:text-polar-500 text-gray-500"
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
                onConfirm={() => cancelSubscription.mutateAsync()}
                destructive
              />
            </div>
          </ShadowBox>
          {hasInvoices && (
            <div className="flex flex-col gap-y-4">
              <h3 className="font-medium">Invoices</h3>
              <List>
                {orders.items?.map((order) => (
                  <ListItem
                    key={order.id}
                    className="flex flex-row items-center justify-between"
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
        isShown={selectedBenefit !== null}
        hide={() => setSelectedBenefit(null)}
        modalContent={
          <div className="px-8 py-10">
            {selectedBenefit && (
              <BenefitDetails
                benefit={selectedBenefit}
                subscription={subscription}
              />
            )}
          </div>
        }
      />
      {organization && (
        <InlineModal
          isShown={showChangePlanModal}
          hide={() => setShowChangePlanModal(false)}
          modalContent={
            <ChangePlanModal
              organization={organization}
              subscription={subscription}
              hide={() => setShowChangePlanModal(false)}
              onUserSubscriptionUpdate={setSubscription}
            />
          }
        />
      )}
    </div>
  )
}

export default ClientPage
