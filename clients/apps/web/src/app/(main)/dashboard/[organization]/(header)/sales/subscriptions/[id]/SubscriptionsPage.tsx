'use client'

import { CustomerContextView } from '@/components/Customer/CustomerContextView'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useModal } from '@/components/Modal/useModal'
import { OrderSection } from '@/components/Orders/OrderSection'
import { SeatViewOnlyTable } from '@/components/Seats/SeatViewOnlyTable'
import CancelSubscriptionModal from '@/components/Subscriptions/CancelSubscriptionModal'
import { SubscriptionDetailsGrid } from '@/components/Subscriptions/SubscriptionDetailsGrid'
import SubscriptionInvoicePreview from '@/components/Subscriptions/SubscriptionInvoicePreview'
import SubscriptionOrdersSection from '@/components/Subscriptions/SubscriptionOrdersSection'
import { SubscriptionSecondaryDetails } from '@/components/Subscriptions/SubscriptionSecondaryDetails'
import UpdateSubscriptionModal from '@/components/Subscriptions/UpdateSubscriptionModal'
import { toast } from '@/components/Toast/use-toast'
import {
  useCustomFields,
  useProduct,
  useSubscription,
  useUncancelSubscription,
} from '@/hooks/queries'
import { useOrganizationSeats } from '@/hooks/queries/seats'
import { extractApiErrorMessage } from '@/utils/api/errors'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import React from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
  subscription: schemas['Subscription']
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  subscription: _subscription,
}) => {
  const { data: subscription } = useSubscription(
    _subscription.id,
    _subscription,
  )
  const { data: customFields } = useCustomFields(organization.id)
  const { data: product } = useProduct(_subscription.product.id)
  const {
    hide: hideCancellationModal,
    show: showCancellationModal,
    isShown: isShownCancellationModal,
  } = useModal()
  const {
    hide: hideUpdateModal,
    show: showUpdateModal,
    isShown: isShownUpdateModal,
  } = useModal()

  const uncancelSubscription = useUncancelSubscription(_subscription.id)

  const hasSeatBasedSubscription =
    !!subscription?.seats && subscription.seats > 0

  const { data: seatsData, isLoading: isLoadingSeats } = useOrganizationSeats(
    hasSeatBasedSubscription ? { subscriptionId: subscription?.id } : undefined,
  )

  const totalSeats = seatsData?.total_seats || 0
  const availableSeats = seatsData?.available_seats || 0
  const seats = seatsData?.seats || []

  const handleUncancel = async () => {
    try {
      await uncancelSubscription.mutateAsync()
      toast({
        title: 'Subscription Uncanceled',
        description:
          'The subscription has been successfully uncanceled and will continue at the next billing cycle.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to uncancel the subscription: ${extractApiErrorMessage(error as Record<string, unknown>)}`,
      })
    }
  }

  if (!subscription || !product) {
    return null
  }

  return (
    <DashboardBody
      title={
        <Box alignItems="center" columnGap="l">
          <Text variant="heading-xs" as="h2">
            Subscription
          </Text>
        </Box>
      }
      className="gap-y-16"
      header={
        <Box alignItems="center" columnGap="l">
          <Button type="button" onClick={showUpdateModal}>
            Update Subscription
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="secondary" size="icon">
                <MoreVertOutlined fontSize="small" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard
                    .writeText(subscription.id)
                    .then(() =>
                      toast({
                        title: 'Subscription ID copied',
                        description:
                          'The subscription ID has been copied to clipboard',
                      }),
                    )
                    .catch(() =>
                      toast({
                        title: 'Failed to copy',
                        description:
                          'Could not copy the subscription ID to clipboard',
                      }),
                    )
                }}
              >
                Copy Subscription ID
              </DropdownMenuItem>
              {subscription.status !== 'canceled' &&
                (subscription.cancel_at_period_end ? (
                  <DropdownMenuItem
                    onClick={handleUncancel}
                    disabled={uncancelSubscription.isPending}
                  >
                    Uncancel
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={showCancellationModal}>
                    Cancel Subscription
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>
      }
      contextViewClassName="bg-transparent dark:bg-transparent border-none rounded-none"
      contextViewTitle="Customer"
      contextView={
        <CustomerContextView
          organization={organization}
          customer={subscription.customer}
        />
      }
    >
      <SubscriptionDetailsGrid
        subscription={subscription}
        product={product}
        organization={organization}
      />

      <SubscriptionInvoicePreview subscription={subscription} />

      <SubscriptionSecondaryDetails
        subscription={subscription}
        customFields={customFields?.items}
      />

      {hasSeatBasedSubscription && (
        <OrderSection
          title="Seats"
          description={
            <Text color="muted">
              {availableSeats} of {totalSeats} seats available
            </Text>
          }
        >
          {!isLoadingSeats && seats.length > 0 && (
            <SeatViewOnlyTable seats={seats} />
          )}
          {!isLoadingSeats && seats.length === 0 && (
            <Text color="muted">No seats have been assigned yet.</Text>
          )}
        </OrderSection>
      )}

      <SubscriptionOrdersSection
        organization={organization}
        subscription={subscription}
      />

      <Box
        flexDirection="column"
        rowGap="l"
        display={{ base: 'flex', md: 'none' }}
      >
        <Text variant="heading-xs" as="h3">
          Customer
        </Text>
        <CustomerContextView
          organization={organization}
          customer={subscription.customer}
        />
      </Box>

      <InlineModal
        isShown={isShownCancellationModal}
        hide={hideCancellationModal}
        modalContent={
          <CancelSubscriptionModal
            subscription={subscription}
            onCancellation={hideCancellationModal}
          />
        }
      />
      <InlineModal
        isShown={isShownUpdateModal}
        hide={hideUpdateModal}
        modalContent={
          <UpdateSubscriptionModal
            subscription={subscription}
            onUpdate={hideUpdateModal}
            organization={organization}
          />
        }
      />
    </DashboardBody>
  )
}

export default ClientPage
