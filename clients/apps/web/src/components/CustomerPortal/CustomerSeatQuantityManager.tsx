'use client'

import { useCustomerUpdateSubscription } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { Client, isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { DetailRow } from '../Shared/DetailRow'
import { toast } from '../Toast/use-toast'

interface CustomerSeatQuantityManagerProps {
  api: Client
  subscription: schemas['CustomerSubscription']
  totalSeats: number
  assignedSeats: number
  onUpdate?: () => void
}

export const CustomerSeatQuantityManager = ({
  api,
  subscription,
  totalSeats,
  assignedSeats,
  onUpdate,
}: CustomerSeatQuantityManagerProps) => {
  const updateSubscription = useCustomerUpdateSubscription(api)

  const availableSeats = totalSeats - assignedSeats

  const { handleSubmit, watch, setValue, setError } = useForm<{
    seats: number
  }>({
    values: {
      seats: totalSeats,
    },
  })

  const seats = watch('seats')
  const canDecrease = seats !== undefined && seats > assignedSeats
  const hasChanges = seats !== totalSeats

  const onSubmit = useCallback(
    async (data: { seats: number }) => {
      try {
        const result = await updateSubscription.mutateAsync({
          id: subscription.id,
          body: {
            seats: data.seats,
          },
        })

        if (result.error) {
          const errorMessage =
            typeof result.error.detail === 'string'
              ? result.error.detail
              : 'Failed to update seats'
          toast({
            title: 'Error updating seats',
            description: errorMessage,
            variant: 'error',
          })
        } else {
          toast({
            title: 'Seats updated',
            description: `Subscription now has ${data.seats} ${data.seats === 1 ? 'seat' : 'seats'}.`,
          })

          onUpdate?.()
        }
      } catch (error) {
        if (isValidationError(error)) {
          setValidationErrors(error, setError)
        } else {
          toast({
            title: 'Error updating seats',
            description:
              error instanceof Error
                ? error.message
                : 'An unexpected error occurred',
            variant: 'error',
          })
        }
      }
    },
    [updateSubscription, subscription.id, onUpdate, setError],
  )

  const handleIncrement = () => {
    if (seats !== undefined) {
      setValue('seats', seats + 1, { shouldValidate: true })
    }
  }

  const handleDecrement = () => {
    if (seats !== undefined && canDecrease) {
      setValue('seats', seats - 1, { shouldValidate: true })
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col">
          <DetailRow
            label="Total Seats"
            value={
              <div className="flex w-full flex-row items-center justify-between gap-2">
                <span className="dark:text-polar-200 font-medium">{seats}</span>
                <div className="flex flex-row items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleDecrement}
                    disabled={!canDecrease || updateSubscription.isPending}
                    className="text-xxs h-6 w-6"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleIncrement}
                    disabled={updateSubscription.isPending}
                    className="text-xxs h-6 w-6"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            }
          />
          <DetailRow
            label="Assigned"
            value={
              <span className="dark:text-polar-200 font-medium">
                {assignedSeats}
              </span>
            }
          />
          <DetailRow
            label="Available"
            value={
              <span className="dark:text-polar-200 font-medium">
                {availableSeats}
              </span>
            }
          />
        </div>

        {hasChanges && (
          <Button
            loading={updateSubscription.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            Update Seats
          </Button>
        )}

        {!canDecrease && seats !== undefined && seats < assignedSeats && (
          <p className="text-xs text-red-500 dark:text-red-400">
            Cannot decrease below {assignedSeats} assigned seats. Revoke seats
            first.
          </p>
        )}
      </form>
    </div>
  )
}
