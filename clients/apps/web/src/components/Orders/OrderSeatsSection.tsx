'use client'

import { SeatViewOnlyTable } from '@/components/Seats/SeatViewOnlyTable'
import { useOrganizationSeats } from '@/hooks/queries/seats'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { OrderSection } from './OrderSection'

export const OrderSeatsSection = ({
  order,
}: {
  order: schemas['Order']
}) => {
  const hasSeatBasedOrder = !!order.seats && order.seats > 0

  const { data: seatsData, isLoading } = useOrganizationSeats(
    hasSeatBasedOrder ? { orderId: order.id } : undefined,
  )

  if (!hasSeatBasedOrder) {
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
    >
      {!isLoading && seats.length > 0 && <SeatViewOnlyTable seats={seats} />}
      {!isLoading && seats.length === 0 && (
        <Text color="muted">No seats have been assigned yet.</Text>
      )}
    </OrderSection>
  )
}
