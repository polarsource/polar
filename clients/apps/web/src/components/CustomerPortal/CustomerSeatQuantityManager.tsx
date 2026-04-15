'use client'

import { useCustomerUpdateSubscription } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { Client, isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'

interface CustomerSeatQuantityManagerProps {
  api: Client
  subscriptionId: string
  totalSeats: number
  availableSeats: number
  prorationBehavior?: schemas['CustomerOrganization']['proration_behavior']
  onUpdate?: () => void
}

export const CustomerSeatQuantityManager = ({
  api,
  subscriptionId,
  totalSeats,
  availableSeats,
  prorationBehavior,
  onUpdate,
}: CustomerSeatQuantityManagerProps) => {
  const updateSubscription = useCustomerUpdateSubscription(api)

  const assignedSeats = totalSeats - availableSeats

  const { handleSubmit, watch, setValue, setError } = useForm<{
    seats: number
  }>({
    values: {
      seats: totalSeats,
    },
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const seats = watch('seats')
  const canDecrease = seats !== undefined && seats > assignedSeats
  const hasChanges = seats !== totalSeats

  const invoicingMessage = useMemo(() => {
    if (!prorationBehavior) return null
    switch (prorationBehavior) {
      case 'invoice':
        return "I'll be charged immediately with a proration for the current month."
      case 'prorate':
        return 'Your next invoice will include the updated seats plus the proration for the current month.'
      case 'next_period':
        return 'The seat update will be applied on your next billing cycle.'
    }
  }, [prorationBehavior])

  const onSubmit = useCallback(
    async (data: { seats: number }) => {
      try {
        const result = await updateSubscription.mutateAsync({
          id: subscriptionId,
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
          const descriptionMessage = (() => {
            const seatText = `${data.seats} ${data.seats === 1 ? 'seat' : 'seats'}`
            switch (prorationBehavior) {
              case 'invoice':
                return `Subscription now has ${seatText}. You'll be charged immediately with a proration for the current month.`
              case 'prorate':
                return `Subscription now has ${seatText}. Your next invoice will include the updated seats plus the proration for the current month.`
              case 'next_period':
                return `Subscription will have ${seatText} starting on your next billing cycle.`
              default:
                return `Subscription now has ${seatText}.`
            }
          })()
          toast({
            title: 'Seats updated',
            description: descriptionMessage,
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
    [updateSubscription, subscriptionId, prorationBehavior, onUpdate, setError],
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
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border p-4">
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium">Total seats</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={handleDecrement}
              disabled={!canDecrease || updateSubscription.isPending}
            >
              <MinusIcon className="h-4 w-4" />
            </Button>

            <span className="dark:text-polar-200 flex h-8 min-w-8 items-center justify-center px-2 font-medium">
              {seats}
            </span>

            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={handleIncrement}
              disabled={updateSubscription.isPending}
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {hasChanges && (
        <div className="mt-4 flex flex-col gap-3">
          {invoicingMessage && (
            <span className="dark:text-polar-500 text-sm text-gray-500">
              {invoicingMessage}
            </span>
          )}
          <div className="flex flex-row-reverse gap-3">
            <Button
              loading={updateSubscription.isPending}
              onClick={handleSubmit(onSubmit)}
              className="w-full"
            >
              Update seats
            </Button>
          </div>
        </div>
      )}

      {!canDecrease && seats !== undefined && seats < assignedSeats && (
        <p className="text-xs text-red-500 dark:text-red-400">
          Cannot decrease below {assignedSeats} assigned seats. Revoke seats
          first.
        </p>
      )}
    </form>
  )
}
