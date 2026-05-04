'use client'

import revalidate from '@/app/actions'
import { SubscriptionStatusLabel } from '@/components/Subscriptions/utils'
import {
  useCustomerClearPendingSubscriptionUpdate,
  useCustomerCancelSubscription,
  useCustomerUncancelSubscription,
} from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import CustomerPortalSubscription from './CustomerPortalSubscription'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import { DetailRow } from '../Shared/DetailRow'
import CustomerCancellationModal from './CustomerCancellationModal'
import CustomerChangePlanModal from './CustomerChangePlanModal'
import { CustomerSubscriptionHeader } from './CustomerSubscriptionHeader'

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
  const [showClearPendingUpdateModal, setShowClearPendingUpdateModal] =
    useState(false)

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
  const clearPendingUpdate = useCustomerClearPendingSubscriptionUpdate(api)
  const router = useRouter()

  const pendingUpdate = subscription.pending_update
  const pendingProduct = products.find(
    (product) => product.id === pendingUpdate?.product_id,
  )

  if (!organization) {
    return null
  }

  return (
    <ShadowBox className="dark:bg-polar-900 flex w-full flex-col gap-y-6 bg-gray-50 dark:border-transparent">
      <CustomerSubscriptionHeader subscription={subscription} />
      <div className="flex flex-col text-sm">
        <DetailRow
          label="Status"
          value={<SubscriptionStatusLabel subscription={subscription} />}
        />
        {subscription.started_at && (
          <DetailRow
            label="Start Date"
            value={
              <FormattedDateTime
                datetime={subscription.started_at}
                dateStyle="long"
              />
            }
          />
        )}
        {subscription.trial_end && subscription.status === 'trialing' ? (
          <DetailRow
            label="Trial Ends"
            value={
              <FormattedDateTime
                datetime={subscription.trial_end}
                dateStyle="long"
              />
            }
          />
        ) : (
          !subscription.ended_at &&
          subscription.current_period_end && (
            <DetailRow
              label={
                subscription.cancel_at_period_end
                  ? 'Expiry Date'
                  : 'Renewal Date'
              }
              value={
                <FormattedDateTime
                  datetime={subscription.current_period_end}
                  dateStyle="long"
                />
              }
            />
          )
        )}
        {subscription.meters.length > 0 && (
          <div className="flex flex-col gap-y-4 py-2">
            <span className="text-lg">Metered Usage</span>
            <div className="flex flex-col gap-y-2">
              {subscription.meters.map((subscriptionMeter) => (
                <DetailRow
                  key={subscriptionMeter.meter.id}
                  label={subscriptionMeter.meter.name}
                  value={formatCurrency('compact')(
                    subscriptionMeter.amount,
                    subscription.currency,
                  )}
                />
              ))}
            </div>
          </div>
        )}
        {subscription.ended_at && (
          <DetailRow
            label="Expired"
            value={
              <FormattedDateTime
                datetime={subscription.ended_at}
                dateStyle="long"
              />
            }
          />
        )}

        {pendingUpdate && (
          <div className="mt-4 flex flex-col gap-y-2">
            <div className="flex flex-row items-center justify-between">
              <h3>Pending Update</h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowClearPendingUpdateModal(true)}
                loading={clearPendingUpdate.isPending}
              >
                Cancel scheduled change
              </Button>
            </div>
            <div className="flex flex-col">
              {pendingProduct && (
                <DetailRow
                  label="New Product"
                  value={`${subscription.product.name} -> ${pendingProduct?.name}`}
                />
              )}
              {pendingUpdate.seats !== null && (
                <DetailRow
                  label="Seats"
                  value={`${subscription.seats} -> ${pendingUpdate.seats}`}
                />
              )}
              <DetailRow
                label="Update in effect from"
                value={
                  <FormattedDateTime
                    datetime={pendingUpdate.applies_at}
                    dateStyle="long"
                  />
                }
              />
            </div>
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
              products={products}
            />
          </div>
        }
      />

      <ConfirmModal
        isShown={showClearPendingUpdateModal}
        hide={() => setShowClearPendingUpdateModal(false)}
        title="Cancel scheduled change"
        description="Your subscription will remain unchanged on the next billing cycle. Are you sure you want to cancel this pending update?"
        onConfirm={async () => {
          await clearPendingUpdate.mutateAsync(subscription.id)
          await revalidate(`customer_portal`)
          router.refresh()
        }}
      />
    </ShadowBox>
  )
}

export default CustomerSubscriptionDetails
