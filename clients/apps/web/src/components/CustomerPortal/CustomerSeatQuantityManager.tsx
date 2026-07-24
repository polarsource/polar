'use client'

import { useCustomerUpdateSubscription } from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import { Client, isValidationError, schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
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
    <Box
      as="form"
      onSubmit={handleSubmit(onSubmit)}
      flexDirection="column"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      padding="l"
    >
      <Box alignItems="center" justifyContent="between" columnGap="l">
        <Text variant="title">Total seats</Text>
        <Box alignItems="center" columnGap="xs">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handleDecrement}
            disabled={!canDecrease || updateSubscription.isPending}
            aria-label="Remove a seat"
          >
            <MinusIcon size={16} />
          </Button>

          <Box
            height={32}
            minWidth={32}
            alignItems="center"
            justifyContent="center"
            paddingHorizontal="s"
          >
            <Text variant="title" tabularNums>
              {seats}
            </Text>
          </Box>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handleIncrement}
            disabled={updateSubscription.isPending}
            aria-label="Add a seat"
          >
            <PlusIcon size={16} />
          </Button>
        </Box>
      </Box>

      {hasChanges && (
        <Box flexDirection="column" rowGap="m" marginTop="l">
          {invoicingMessage && <Text color="muted">{invoicingMessage}</Text>}
          <Button
            loading={updateSubscription.isPending}
            onClick={handleSubmit(onSubmit)}
            fullWidth
          >
            Update seats
          </Button>
        </Box>
      )}
    </Box>
  )
}
