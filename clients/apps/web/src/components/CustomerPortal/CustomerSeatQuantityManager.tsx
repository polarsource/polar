'use client'

import { useCustomerUpdateSubscription } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { Client, isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { ThemingPresetProps } from '@polar-sh/ui/hooks/theming'
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
  themingPreset: ThemingPresetProps
}

export const CustomerSeatQuantityManager = ({
  api,
  subscription,
  totalSeats,
  assignedSeats,
  onUpdate,
  themingPreset,
}: CustomerSeatQuantityManagerProps) => {
  const updateSubscription = useCustomerUpdateSubscription(api)

  const availableSeats = totalSeats - assignedSeats

  const { register, handleSubmit, watch, setValue, setError } = useForm<{
    seats: number
  }>({
    defaultValues: {
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
      <DetailRow
        label="Total Seats"
        value={
          <span className="dark:text-polar-200 font-medium">{totalSeats}</span>
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

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="dark:border-polar-700 mt-2 flex flex-col gap-3 border-t border-gray-200 pt-4"
      >
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handleDecrement}
            disabled={!canDecrease || updateSubscription.isPending}
            className={themingPreset.polar.buttonSecondary}
          >
            <MinusIcon className="h-4 w-4" />
          </Button>
          <Input
            {...register('seats', {
              valueAsNumber: true,
              min: assignedSeats,
            })}
            type="number"
            min={assignedSeats}
            className="w-20 text-center"
            disabled={updateSubscription.isPending}
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handleIncrement}
            disabled={updateSubscription.isPending}
            className={themingPreset.polar.buttonSecondary}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
          <Button
            type="submit"
            disabled={!hasChanges || updateSubscription.isPending}
            loading={updateSubscription.isPending}
            size="sm"
            className={themingPreset.polar.button}
          >
            Update
          </Button>
        </div>

        {!canDecrease && seats !== undefined && seats < assignedSeats && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Cannot decrease below {assignedSeats} assigned seats. Revoke seats
            first.
          </p>
        )}
      </form>
    </div>
  )
}
