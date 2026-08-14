'use client'

import { useModal } from '@/components/Modal/useModal'
import { OrderSection } from '@/components/Orders/OrderSection'
import { useOrganizationSeats } from '@/hooks/queries/seats'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal, Text } from '@polar-sh/orbit'
import { AssignSeatModal } from './AssignSeatModal'
import { OrganizationSeatTable } from './OrganizationSeatTable'

export const SubscriptionSeatsSection = ({
  subscription,
}: {
  subscription: schemas['Subscription']
}) => {
  const hasSeatBasedSubscription =
    !!subscription.seats && subscription.seats > 0

  const { data: seatsData, isLoading } = useOrganizationSeats(
    hasSeatBasedSubscription ? { subscriptionId: subscription.id } : undefined,
  )
  const {
    isShown: isAssignModalShown,
    show: showAssignModal,
    hide: hideAssignModal,
  } = useModal()

  if (!hasSeatBasedSubscription) {
    return null
  }

  const totalSeats = seatsData?.total_seats || 0
  const availableSeats = seatsData?.available_seats || 0
  const seats = seatsData?.seats || []

  return (
    <OrderSection
      title="Seats"
      description={
        <Text color="muted">
          {availableSeats} of {totalSeats} seats available
        </Text>
      }
      action={
        <Button onClick={showAssignModal} disabled={availableSeats === 0}>
          Assign Seat
        </Button>
      }
    >
      {!isLoading && seats.length > 0 && (
        <OrganizationSeatTable seats={seats} />
      )}
      {!isLoading && seats.length === 0 && (
        <Text color="muted">No seats have been assigned yet.</Text>
      )}
      <InlineModal
        isShown={isAssignModalShown}
        hide={hideAssignModal}
        modalContent={
          <AssignSeatModal subscription={subscription} hide={hideAssignModal} />
        }
      />
    </OrderSection>
  )
}
