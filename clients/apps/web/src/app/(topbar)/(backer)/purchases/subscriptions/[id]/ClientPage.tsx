'use client'

import BenefitDetails from '@/components/Benefit/BenefitDetails'
import { BenefitRow } from '@/components/Benefit/BenefitRow'
import { previewOpts } from '@/components/Feed/Markdown/BrowserRender'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { InlineModal } from '@/components/Modal/InlineModal'
import ProductPriceLabel from '@/components/Products/ProductPriceLabel'
import {
  useCancelSubscription,
  useOrganization,
  useUserBenefits,
  useUserOrderInvoice,
  useUserOrders,
} from '@/hooks/queries'
import { formatCurrencyAndAmount } from '@/utils/money'
import { organizationPageLink } from '@/utils/nav'
import { ArrowBackOutlined, ReceiptOutlined } from '@mui/icons-material'
import { UserBenefit, UserOrder, UserSubscription } from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import Link from 'next/link'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useCallback, useState } from 'react'

const ClientPage = ({ subscription }: { subscription: UserSubscription }) => {
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

  const cancelSubscription = useCancelSubscription(subscription.id)
  const isCanceled =
    cancelSubscription.isPending ||
    cancelSubscription.isSuccess ||
    subscription.ended_at ||
    subscription.cancel_at_period_end
  const isFreeTier = subscription.product.type === 'free'
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
      <div className="flex h-full flex-grow flex-row items-start gap-x-12">
        <div className="flex w-full flex-col gap-8 md:w-full">
          {benefits?.items && (
            <ShadowBox className="flex flex-col gap-6 ring-gray-100">
              {benefits.items.map((benefit) => (
                <>
                  <BenefitRow
                    key={benefit.id}
                    benefit={benefit}
                    selected={benefit.id === selectedBenefit?.id}
                    onSelect={() => setSelectedBenefit(benefit)}
                  />
                </>
              ))}
            </ShadowBox>
          )}
          <InlineModal
            isShown={selectedBenefit !== null}
            hide={() => setSelectedBenefit(null)}
            modalContent={
              <div className="px-8 py-10">
                {selectedBenefit && (
                  <BenefitDetails benefit={selectedBenefit} />
                )}
              </div>
            }
          />
        </div>
        <div className="flex w-full max-w-[340px] flex-col gap-8">
          <ShadowBox className="flex flex-col gap-8 md:ring-gray-100">
            <h3 className="text-lg font-medium">{subscription.product.name}</h3>
            <div className="flex flex-col gap-4">
              <h1 className="text-5xl font-light text-blue-500 dark:text-blue-400">
                {subscription.price && (
                  <ProductPriceLabel price={subscription.price} />
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
              {organization && (
                <Link
                  href={organizationPageLink(organization, 'subscriptions')}
                >
                  <Button size="lg" fullWidth>
                    Upgrade
                  </Button>
                </Link>
              )}
              {!isCanceled && (
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-red-500 dark:text-red-400"
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
                  isFreeTier
                    ? `You won't have access to your benefits anymore.`
                    : `At the end of your billing period, you won't have access to your benefits anymore.`
                }
                destructiveText="Unsubscribe"
                onConfirm={() => cancelSubscription.mutateAsync()}
                destructive
              />
            </div>
          </ShadowBox>
          <div className="flex flex-col gap-y-4">
            <h3 className="font-medium">Invoices</h3>
            <ShadowBox className="flex flex-col gap-y-4">
              <>
                {orders?.items &&
                  orders.items.length > 0 &&
                  orders.items?.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <FormattedDateTime
                          datetime={order.created_at}
                          dateStyle="medium"
                          resolution="day"
                        />{' '}
                        —{' '}
                        {formatCurrencyAndAmount(
                          order.amount,
                          order.currency,
                          0,
                        )}
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
                    </div>
                  ))}
              </>
            </ShadowBox>
          </div>
          <div className="flex flex-col gap-y-4">
            {/* {'media' in order.product && order.product.media.length && (
            <Slideshow images={order.product.media} />
          )} */}
            <ShadowBox className="flex flex-col gap-6 ring-gray-100">
              <div className="prose dark:prose-invert prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-md prose-h6:text-sm dark:prose-headings:text-polar-50 dark:text-polar-300 max-w-4xl text-gray-800">
                <Markdown
                  options={{
                    ...previewOpts,
                    overrides: {
                      ...previewOpts.overrides,
                      a: (props) => (
                        <a {...props} rel="noopener noreferrer nofollow" />
                      ),
                    },
                  }}
                >
                  {subscription.product.description ?? ''}
                </Markdown>
              </div>
            </ShadowBox>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClientPage
