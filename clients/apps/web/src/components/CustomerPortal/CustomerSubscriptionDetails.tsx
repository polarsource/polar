'use client'

import revalidate from '@/app/actions'
import { toast } from '@/components/Toast/use-toast'
import {
  useCustomerClearPendingSubscriptionUpdate,
  useCustomerCancelSubscription,
  usePortalAuthenticatedUser,
} from '@/hooks/queries/customerPortal'
import { hasBillingPermission } from '@/utils/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import CustomerPortalSubscription from './CustomerPortalSubscription'
import { InlineModal } from '@polar-sh/orbit'
import { useModal } from '../Modal/useModal'
import { CurrentPeriodOverview } from './CurrentPeriodOverview'
import { PortalConfirmDialog, PortalDrawerHeader } from './PortalDialog'
import { PortalCard, PortalRow, PortalRows } from './PortalPrimitives'
import { SubscriptionRetryPaymentButton } from './SubscriptionRetryPaymentButton'
import { UpcomingUsageCharge } from './UpcomingUsageCharge'
import { PendingUpdateRows, SubscriptionDateRows } from './SubscriptionDateRows'
import CustomerChangePlanModal from './CustomerChangePlanModal'
import { CustomerSubscriptionHeader } from './CustomerSubscriptionHeader'
import UncancelSubscriptionButton from './UncancelSubscriptionButton'
import {
  TrialBillingDetailsAlert,
  TrialEndedAlert,
  TrialEndedSubscriptionActions,
  TrialSubscriptionActions,
} from './TrialSubscriptionActions'

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
  const [now] = useState(() => Date.now())
  const [showChangePlanModal, setShowChangePlanModal] = useState(false)
  const [showClearPendingUpdateModal, setShowClearPendingUpdateModal] =
    useState(false)

  const {
    isShown: isBenefitGrantsModalOpen,
    hide: hideBenefitGrantsModal,
    show: showBenefitGrantsModal,
  } = useModal()

  const { data: authenticatedUser } = usePortalAuthenticatedUser(api)
  const canManageBilling = hasBillingPermission(authenticatedUser)

  const cancelSubscription = useCustomerCancelSubscription(api)

  const isCanceled =
    cancelSubscription.isPending ||
    cancelSubscription.isSuccess ||
    !!subscription.ended_at ||
    !!subscription.ends_at

  const isPastDue = subscription.status === 'past_due'
  const isTrialing = subscription.status === 'trialing'
  const isTrialEnded = subscription.status === 'trial_ended'
  const isPausingIndefinitely =
    (subscription.status === 'paused' || subscription.pause_at_period_end) &&
    !subscription.resumes_at
  const showMeteredUsage =
    subscription.meters.length > 0 && (isPastDue || isPausingIndefinitely)

  const organization = subscription.product.organization

  const showSubscriptionUpdates =
    organization.customer_portal_settings.subscription.update_plan === true

  const clearPendingUpdate = useCustomerClearPendingSubscriptionUpdate(api)
  const router = useRouter()
  const searchParams = useSearchParams()

  const pendingUpdate = subscription.pending_update

  const canUncancel =
    isCanceled &&
    subscription.cancel_at_period_end &&
    !!subscription.current_period_end &&
    new Date(subscription.current_period_end).getTime() > now

  if (!organization) {
    return null
  }

  return (
    <PortalCard rowGap="xl">
      {isTrialing && !isCanceled && (
        <TrialBillingDetailsAlert subscription={subscription} />
      )}
      {isTrialEnded && <TrialEndedAlert subscription={subscription} />}

      <CustomerSubscriptionHeader subscription={subscription} />

      <PortalRows>
        <SubscriptionDateRows subscription={subscription} />
      </PortalRows>

      {pendingUpdate && (
        <Box
          flexDirection="column"
          rowGap="m"
          paddingTop="l"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <Box justifyContent="between" alignItems="center" columnGap="l">
            <Box as="span" color="text-primary">
              Scheduled change
            </Box>
            {canManageBilling && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearPendingUpdateModal(true)}
                loading={clearPendingUpdate.isPending}
              >
                Cancel change
              </Button>
            )}
          </Box>
          <PortalRows>
            <PendingUpdateRows
              subscription={subscription}
              products={products}
            />
          </PortalRows>
        </Box>
      )}

      {showMeteredUsage && (
        <Box
          flexDirection="column"
          rowGap="m"
          paddingTop="l"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <Box as="span" color="text-primary">
            Metered usage
          </Box>
          <PortalRows>
            {subscription.meters.map((meter) => (
              <PortalRow
                numeric
                key={meter.id}
                label={meter.meter.name}
                value={formatCurrency('compact')(
                  meter.amount,
                  subscription.currency,
                )}
              />
            ))}
          </PortalRows>
        </Box>
      )}

      <UpcomingUsageCharge subscription={subscription} api={api} />

      <CurrentPeriodOverview
        api={api}
        products={products}
        subscription={subscription}
      />

      <Box columnGap="s" rowGap="s" flexWrap="wrap" justifyContent="end">
        {isTrialEnded ? (
          <TrialEndedSubscriptionActions
            api={api}
            subscription={subscription}
          />
        ) : isTrialing && !isCanceled ? (
          <TrialSubscriptionActions
            api={api}
            subscription={subscription}
            canChangePlan={showSubscriptionUpdates}
            onChangePlan={() => setShowChangePlanModal(true)}
          />
        ) : (
          <>
            {showSubscriptionUpdates && !isCanceled && !isPastDue && (
              <Button
                onClick={() => setShowChangePlanModal(true)}
                variant="secondary"
              >
                Change plan
              </Button>
            )}

            {!isTrialing && (
              <>
                <Box display={{ base: 'none', md: 'flex' }}>
                  <Button
                    variant={canUncancel || isPastDue ? 'secondary' : 'default'}
                    onClick={showBenefitGrantsModal}
                  >
                    Manage subscription
                  </Button>
                </Box>
                <Box display={{ base: 'flex', md: 'none' }}>
                  <Link
                    href={`/${organization.slug}/portal/subscriptions/${subscription.id}?${searchParams.toString()}`}
                  >
                    <Button
                      variant={
                        canUncancel || isPastDue ? 'secondary' : 'default'
                      }
                    >
                      Manage subscription
                    </Button>
                  </Link>
                </Box>
              </>
            )}

            {isPastDue && (
              <SubscriptionRetryPaymentButton
                api={api}
                subscription={subscription}
              />
            )}

            {canUncancel && (
              <UncancelSubscriptionButton
                api={api}
                subscription={subscription}
                customerSessionToken={customerSessionToken}
                onUncancelled={async () => {
                  await revalidate(`customer_portal`)
                  router.refresh()
                }}
              />
            )}
          </>
        )}
      </Box>

      <CustomerChangePlanModal
        isShown={showChangePlanModal}
        api={api}
        organization={organization}
        products={products}
        subscription={subscription}
        hide={() => setShowChangePlanModal(false)}
        onUserSubscriptionUpdate={onUserSubscriptionUpdate}
      />

      <InlineModal
        isShown={isBenefitGrantsModalOpen}
        hide={hideBenefitGrantsModal}
        modalContent={
          <>
            <PortalDrawerHeader
              title="Subscription"
              hide={hideBenefitGrantsModal}
            />
            <Box flexDirection="column" padding="2xl">
              <CustomerPortalSubscription
                api={api}
                customerSessionToken={customerSessionToken}
                subscription={subscription}
                products={products}
              />
            </Box>
          </>
        }
      />

      <PortalConfirmDialog
        isShown={showClearPendingUpdateModal}
        hide={() => setShowClearPendingUpdateModal(false)}
        title="Cancel scheduled change?"
        description="Your subscription will stay as it is on the next billing cycle."
        cancelText="Keep change"
        confirmText="Cancel change"
        onConfirm={async () => {
          try {
            await clearPendingUpdate.mutateAsync(subscription.id)
            await revalidate(`customer_portal`)
            router.refresh()
          } catch (error) {
            toast({
              title: 'Error',
              description: `Failed to cancel the scheduled change: ${(error as Error).message}`,
            })
          }
        }}
      />
    </PortalCard>
  )
}

export default CustomerSubscriptionDetails
