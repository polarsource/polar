'use client'

import revalidate from '@/app/actions'
import {
  useCustomerClearPendingSubscriptionUpdate,
  useCustomerCancelSubscription,
} from '@/hooks/queries/customerPortal'
import { Client, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import CustomerPortalSubscription from './CustomerPortalSubscription'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { InlineModal } from '@polar-sh/orbit'
import { useModal } from '../Modal/useModal'
import { CurrentPeriodOverview } from './CurrentPeriodOverview'
import { PortalCard, PortalRows } from './PortalPrimitives'
import { PendingUpdateRows, SubscriptionDateRows } from './SubscriptionDateRows'
import CustomerChangePlanModal from './CustomerChangePlanModal'
import { CustomerSubscriptionHeader } from './CustomerSubscriptionHeader'
import UncancelSubscriptionButton from './UncancelSubscriptionButton'

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

  const clearPendingUpdate = useCustomerClearPendingSubscriptionUpdate(api)
  const router = useRouter()

  const pendingUpdate = subscription.pending_update

  if (!organization) {
    return null
  }

  return (
    <PortalCard rowGap="xl">
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowClearPendingUpdateModal(true)}
              loading={clearPendingUpdate.isPending}
            >
              Cancel change
            </Button>
          </Box>
          <PortalRows>
            <PendingUpdateRows
              subscription={subscription}
              products={products}
            />
          </PortalRows>
        </Box>
      )}

      <CurrentPeriodOverview
        api={api}
        products={products}
        subscription={subscription}
      />

      <Box columnGap="s" rowGap="s" flexWrap="wrap">
        <Box display={{ base: 'none', md: 'flex' }}>
          <Button onClick={showBenefitGrantsModal}>Manage subscription</Button>
        </Box>
        <Box display={{ base: 'flex', md: 'none' }}>
          <Link
            href={`/${organization.slug}/portal/subscriptions/${subscription.id}?customer_session_token=${customerSessionToken}`}
          >
            <Button>Manage subscription</Button>
          </Link>
        </Box>

        {showSubscriptionUpdates && !isCanceled && (
          <Button
            onClick={() => setShowChangePlanModal(true)}
            variant="secondary"
          >
            Change plan
          </Button>
        )}

        {isCanceled &&
          subscription.cancel_at_period_end &&
          subscription.current_period_end &&
          new Date(subscription.current_period_end) > new Date() && (
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
      </Box>

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
          <Box flexDirection="column" overflowY="auto" padding="2xl">
            <CustomerPortalSubscription
              api={api}
              customerSessionToken={customerSessionToken}
              subscription={subscription}
              products={products}
            />
          </Box>
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
    </PortalCard>
  )
}

export default CustomerSubscriptionDetails
