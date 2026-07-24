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
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import CustomerPortalSubscription from './CustomerPortalSubscription'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { InlineModal } from '@polar-sh/orbit'
import { useModal } from '../Modal/useModal'
import { DetailItem } from '../Shared/Section'
import { getScheduleRows } from '../Subscriptions/subscriptionState'
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
    <Box
      flexDirection="column"
      rowGap="xl"
      width="100%"
      borderRadius="xl"
      backgroundColor="background-card"
      padding="2xl"
    >
      <CustomerSubscriptionHeader subscription={subscription} />
      <Box flexDirection="column">
        <DetailItem
          label="Status"
          value={<SubscriptionStatusLabel subscription={subscription} />}
        />
        {subscription.started_at && (
          <DetailItem
            label="Started"
            value={
              <Text as="span">
                <FormattedDateTime
                  datetime={subscription.started_at}
                  dateStyle="long"
                />
              </Text>
            }
          />
        )}
        {getScheduleRows(subscription).map((row) => (
          <DetailItem
            key={row.key}
            label={row.label}
            value={
              row.datetime ? (
                <Text as="span">
                  <FormattedDateTime datetime={row.datetime} dateStyle="long" />
                </Text>
              ) : (
                row.fallback
              )
            }
          />
        ))}
        {subscription.meters.length > 0 && (
          <Box flexDirection="column" rowGap="l" paddingVertical="s">
            <Text variant="heading-xxs" as="h3">
              Metered usage
            </Text>
            <Box flexDirection="column" rowGap="s">
              {subscription.meters.map((subscriptionMeter) => (
                <DetailItem
                  key={subscriptionMeter.meter.id}
                  label={subscriptionMeter.meter.name}
                  value={formatCurrency('compact')(
                    subscriptionMeter.amount,
                    subscription.currency,
                  )}
                />
              ))}
            </Box>
          </Box>
        )}

        {pendingUpdate && (
          <Box flexDirection="column" rowGap="s" marginTop="l">
            <Box alignItems="center" justifyContent="between" columnGap="m">
              <Text variant="heading-xxs" as="h3">
                Pending update
              </Text>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowClearPendingUpdateModal(true)}
                loading={clearPendingUpdate.isPending}
              >
                Cancel scheduled change
              </Button>
            </Box>
            <Box flexDirection="column">
              {pendingProduct && (
                <DetailItem
                  label="New product"
                  value={`${subscription.product.name} → ${pendingProduct.name}`}
                />
              )}
              {pendingUpdate.seats !== null && (
                <DetailItem
                  label="Seats"
                  value={`${subscription.seats} → ${pendingUpdate.seats}`}
                />
              )}
              <DetailItem
                label="Update in effect from"
                value={
                  <Text as="span">
                    <FormattedDateTime
                      datetime={pendingUpdate.applies_at}
                      dateStyle="long"
                    />
                  </Text>
                }
              />
            </Box>
          </Box>
        )}
      </Box>

      <Box flexDirection="row" columnGap="l">
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
    </Box>
  )
}

export default CustomerSubscriptionDetails
