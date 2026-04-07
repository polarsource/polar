'use client'

import revalidate from '@/app/actions'
import AmountLabel from '@/components/Shared/AmountLabel'
import { SubscriptionStatusLabel } from '@/components/Subscriptions/utils'
import {
  useCustomerCancelSubscription,
  useCustomerUncancelSubscription,
} from '@/hooks/queries'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import CustomerPortalSubscription from '../CustomerPortal/CustomerPortalSubscription'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import CustomerCancellationModal from './CustomerCancellationModal'
import CustomerChangePlanModal from './CustomerChangePlanModal'

const CustomerSubscriptionDetails = ({
  subscription,
  products,
  api,
  onUserSubscriptionUpdate,
  customerSessionToken,
}: {
  subscription: schemas['CustomerSubscription']
  products: schemas['CustomerProduct'][]
  api: Client
  onUserSubscriptionUpdate: (
    subscription: schemas['CustomerSubscription'],
  ) => void
  customerSessionToken: string
}) => {
  const [showChangePlanModal, setShowChangePlanModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  const {
    isShown: isBenefitGrantsModalOpen,
    hide: hideBenefitGrantsModal,
    show: showBenefitGrantsModal,
  } = useModal()

  const cancelSubscription = useCustomerCancelSubscription(api)

  const isCanceled =
    cancelSubscription.isPending ||
    cancelSubscription.isSuccess ||
    !!subscription.ended_at ||
    !!subscription.ends_at

  const organization = subscription.product.organization

  const showSubscriptionUpdates =
    organization.customer_portal_settings.subscription.update_plan === true

  const uncancelSubscription = useCustomerUncancelSubscription(api)
  const router = useRouter()

  const subscriptionBaseAmount = useMemo(() => {
    const price = subscription.product.prices.find(
      ({ amount_type }) => amount_type === 'fixed' || amount_type === 'custom',
    )

    if (!price) {
      return null
    }

    // This should be obsolete but I don't think we have proper type guards for the generated schema
    if ('price_amount' in price) {
      return price.price_amount
    }

    return null
  }, [subscription])

  if (!organization) {
    return null
  }

  return (
    <ShadowBox className="dark:bg-polar-900 flex w-full flex-col gap-y-6 bg-gray-50 dark:border-transparent">
      <div className="flex flex-row items-start justify-between">
        <div className="flex flex-row items-baseline gap-x-6">
          <h3 className="truncate text-xl">{subscription.product.name}</h3>
          <div className="dark:text-polar-500 text-xl text-gray-500">
            {subscription.amount && subscription.currency ? (
              <span className="flex flex-row justify-end gap-x-1">
                {subscriptionBaseAmount &&
                  subscription.amount !== subscriptionBaseAmount && (
                    <span className="text-gray-500 line-through">
                      {formatCurrency('compact')(
                        subscriptionBaseAmount,
                        subscription.currency,
                      )}
                    </span>
                  )}
                <AmountLabel
                  amount={subscription.amount}
                  currency={subscription.currency}
                  interval={subscription.recurring_interval}
                  intervalCount={subscription.recurring_interval_count}
                />
              </span>
            ) : (
              <span>Free</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-y-2 text-sm">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-500 text-gray-500">Status</span>
          <SubscriptionStatusLabel subscription={subscription} />
        </div>
        {subscription.started_at && (
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              Start Date
            </span>
            <span>
              <FormattedDateTime
                datetime={subscription.started_at}
                dateStyle="long"
              />
            </span>
          </div>
        )}
        {subscription.trial_end && subscription.status === 'trialing' ? (
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              Trial Ends
            </span>
            <span>
              <FormattedDateTime
                datetime={subscription.trial_end}
                dateStyle="long"
              />
            </span>
          </div>
        ) : (
          !subscription.ended_at &&
          subscription.current_period_end && (
            <div className="flex flex-row items-center justify-between">
              <span className="dark:text-polar-500 text-gray-500">
                {subscription.cancel_at_period_end
                  ? 'Expiry Date'
                  : 'Renewal Date'}
              </span>
              <span>
                <FormattedDateTime
                  datetime={subscription.current_period_end}
                  dateStyle="long"
                />
              </span>
            </div>
          )
        )}
        {subscription.meters.length > 0 && (
          <div className="flex flex-col gap-y-4 py-2">
            <span className="text-lg">Metered Usage</span>
            <div className="flex flex-col gap-y-2">
              {subscription.meters.map((subscriptionMeter) => (
                <div
                  key={subscriptionMeter.meter.id}
                  className="flex flex-row items-center justify-between"
                >
                  <span className="dark:text-polar-500 text-gray-500">
                    {subscriptionMeter.meter.name}
                  </span>
                  <span>
                    {formatCurrency('compact')(
                      subscriptionMeter.amount,
                      subscription.currency,
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {subscription.ended_at && (
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">Expired</span>
            <span>
              <FormattedDateTime
                datetime={subscription.ended_at}
                dateStyle="long"
              />
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-row gap-4">
        {isCanceled &&
          subscription.cancel_at_period_end &&
          subscription.current_period_end &&
          new Date(subscription.current_period_end) > new Date() && (
            <Button
              onClick={async () => {
                await uncancelSubscription.mutateAsync({ id: subscription.id })
                await revalidate(`customer_portal`)
                router.refresh()
              }}
              loading={uncancelSubscription.isPending}
            >
              Uncancel
            </Button>
          )}

        <Button className="hidden md:flex" onClick={showBenefitGrantsModal}>
          Manage subscription
        </Button>
        <Link
          className="md:hidden"
          href={`/${organization.slug}/portal/subscriptions/${subscription.id}?customer_session_token=${customerSessionToken}`}
        >
          <Button>Manage subscription</Button>
        </Link>

        {showSubscriptionUpdates &&
          !isCanceled &&
          subscription.status !== 'trialing' && (
            <Button
              onClick={() => setShowChangePlanModal(true)}
              variant="secondary"
            >
              Change plan
            </Button>
          )}

        <CustomerCancellationModal
          isShown={showCancelModal}
          hide={() => setShowCancelModal(false)}
          subscription={subscription}
          cancelSubscription={cancelSubscription}
        />
      </div>

      <InlineModal
        isShown={showChangePlanModal}
        hide={() => setShowChangePlanModal(false)}
        modalContent={
          <CustomerChangePlanModal
            api={api}
            organization={organization}
            products={products}
            subscription={subscription}
            hide={() => setShowChangePlanModal(false)}
            onUserSubscriptionUpdate={onUserSubscriptionUpdate}
          />
        }
      />

      <InlineModal
        isShown={isBenefitGrantsModalOpen}
        hide={hideBenefitGrantsModal}
        modalContent={
          <div className="flex flex-col overflow-y-auto p-8">
            <CustomerPortalSubscription
              api={api}
              customerSessionToken={customerSessionToken}
              subscription={subscription}
            />
          </div>
        }
      />
    </ShadowBox>
  )
}

export default CustomerSubscriptionDetails
