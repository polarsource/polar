import revalidate from '@/app/actions'
import { Client, schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { subscriptionStatusDisplayNames } from '@/components/Subscriptions/utils'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { useCallback, useState } from 'react'
import { InlineModal } from '@polar-sh/orbit'
import { useModal } from '../Modal/useModal'
import CustomerSubscriptionDetails from './CustomerSubscriptionDetails'
import CustomerPortalSubscription from './CustomerPortalSubscription'
import { PortalDrawerHeader } from './PortalDialog'
import {
  PortalCardList,
  PortalEmptyState,
  PortalListItem,
  PortalSection,
} from './PortalPrimitives'
import { SubscriptionStatusPill } from './SubscriptionStatusPill'

interface SubscriptionsOverviewProps {
  organization: schemas['CustomerOrganization']
  subscriptions: schemas['CustomerSubscription'][]
  products: schemas['CustomerProduct'][]
  api: Client
  customerSessionToken: string
}

export const ActiveSubscriptionsOverview = ({
  subscriptions,
  products,
  api,
  customerSessionToken,
}: SubscriptionsOverviewProps) => {
  const onSubscriptionUpdate = useCallback(async () => {
    await revalidate(`customer_portal`)
  }, [])

  return (
    <PortalSection title="Subscriptions">
      {subscriptions.length > 0 ? (
        <Box flexDirection="column" rowGap="l">
          {subscriptions.map((s) => (
            <CustomerSubscriptionDetails
              key={s.id}
              api={api}
              subscription={s}
              products={products}
              onUserSubscriptionUpdate={onSubscriptionUpdate}
              customerSessionToken={customerSessionToken}
            />
          ))}
        </Box>
      ) : (
        <PortalEmptyState title="No subscriptions found" />
      )}
    </PortalSection>
  )
}

export const InactiveSubscriptionsOverview = ({
  subscriptions,
  products,
  api,
  customerSessionToken,
}: SubscriptionsOverviewProps) => {
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<
    string | null
  >(null)
  // Derive from the (refreshable) subscriptions prop rather than snapshotting,
  // so a cancellation reflects here after the list refetches.
  const selectedSubscription =
    subscriptions.find((s) => s.id === selectedSubscriptionId) ?? null

  const {
    isShown: isSubscriptionModalOpen,
    hide: _hideSubscriptionModal,
    show: showSubscriptionModal,
  } = useModal()

  const openSubscriptionModal = useCallback(
    (subscription: schemas['CustomerSubscription']) => {
      setSelectedSubscriptionId(subscription.id)
      showSubscriptionModal()
    },
    [showSubscriptionModal],
  )

  const hideSubscriptionModal = useCallback(() => {
    setSelectedSubscriptionId(null)
    _hideSubscriptionModal()
  }, [_hideSubscriptionModal])

  return (
    <PortalSection title="Past subscriptions">
      <PortalCardList>
        {subscriptions.map((subscription) => (
          <PortalListItem
            key={subscription.id}
            onClick={() => openSubscriptionModal(subscription)}
            title={subscription.product.name}
            subtitle={
              subscription.ended_at ? (
                <>
                  Ended{' '}
                  <FormattedDateTime
                    datetime={subscription.ended_at}
                    dateStyle="medium"
                    resolution="day"
                  />
                </>
              ) : (
                subscriptionStatusDisplayNames[subscription.status]
              )
            }
            meta={<SubscriptionStatusPill subscription={subscription} />}
          />
        ))}
      </PortalCardList>

      <InlineModal
        isShown={isSubscriptionModalOpen}
        hide={hideSubscriptionModal}
        modalContent={
          selectedSubscription ? (
            <>
              <PortalDrawerHeader
                title="Subscription"
                hide={hideSubscriptionModal}
              />
              <Box flexDirection="column" padding="2xl">
                <CustomerPortalSubscription
                  api={api}
                  customerSessionToken={customerSessionToken}
                  subscription={selectedSubscription}
                  products={products}
                />
              </Box>
            </>
          ) : null
        }
      />
    </PortalSection>
  )
}
