'use client'

import { useOrganizationSeats } from '@/hooks/queries/seats'
import { useUpdateSubscription } from '@/hooks/queries/subscriptions'
import { extractApiErrorMessage, setValidationErrors } from '@/utils/api/errors'
import { getQueryClient } from '@/utils/api/query'
import { isValidationError, schemas } from '@polar-sh/client'
import { Button, Input } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { ProrationBehavior } from '../Settings/ProrationBehavior'
import { toast } from '../Toast/use-toast'
import { subscriptionUpdateValidationDiscriminators } from './utils'

export const UpdateSubscriptionSeatsForm = ({
  subscription,
  onUpdate,
  organization,
}: {
  subscription: schemas['Subscription']
  onUpdate?: () => void
  organization: schemas['Organization']
}) => {
  const updateSubscription = useUpdateSubscription(subscription.id)

  const { data: seatsData } = useOrganizationSeats({
    subscriptionId: subscription.id,
  })
  const assignedSeats =
    (seatsData?.total_seats ?? 0) - (seatsData?.available_seats ?? 0)
  const minimumSeats = Math.max(assignedSeats, 1)

  const defaultProrationBehavior =
    organization.subscription_settings.proration_behavior

  const form = useForm<schemas['SubscriptionUpdateSeats']>({
    defaultValues: {
      seats: subscription.seats ?? 1,
      proration_behavior: defaultProrationBehavior,
    },
  })
  const { control, handleSubmit, setError } = form

  const onSubmit = useCallback(
    async (body: schemas['SubscriptionUpdateSeats']) => {
      await updateSubscription.mutateAsync(body).then(({ error }) => {
        if (error) {
          if (error.detail)
            if (isValidationError(error.detail)) {
              setValidationErrors(
                error.detail,
                setError,
                undefined,
                subscriptionUpdateValidationDiscriminators,
              )
            } else {
              toast({
                title: 'Seats update failed',
                description: `Error while updating seats for ${subscription.product.name}: ${extractApiErrorMessage(error)}`,
              })
            }
          return
        }

        getQueryClient().invalidateQueries({
          queryKey: ['organization_seats'],
        })
        toast({
          title: 'Seats updated',
          description: `Seats for ${subscription.product.name} have been successfully updated`,
        })
        onUpdate?.()
      })
    },
    [updateSubscription, subscription, setError, onUpdate],
  )

  return (
    <Form {...form}>
      <form
        className="flex grow flex-col justify-between gap-y-6"
        onSubmit={handleSubmit(onSubmit)}
      >
        <Box flexDirection="column" rowGap="xl">
          <FormField
            control={control}
            name="seats"
            rules={{
              required: 'Seats is required',
              min: {
                value: minimumSeats,
                message:
                  assignedSeats > 0
                    ? `Cannot be fewer than the ${assignedSeats} assigned seats`
                    : 'Must be at least 1 seat',
              },
              validate: (value) =>
                Number.isInteger(value) || 'Must be a whole number',
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total seats</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={minimumSeats}
                    step={1}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const value = e.target.value
                      field.onChange(
                        value === '' ? undefined : parseInt(value, 10),
                      )
                    }}
                  />
                </FormControl>
                <FormDescription>
                  {assignedSeats} of {subscription.seats ?? 0} seats currently
                  assigned
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {subscription.status !== 'trialing' && (
            <FormField
              control={control}
              name="proration_behavior"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proration behavior</FormLabel>
                  <FormControl>
                    <div>
                      <ProrationBehavior
                        organization={organization}
                        value={field.value || defaultProrationBehavior}
                        onValueChange={field.onChange}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </Box>
        <Button
          type="submit"
          size="lg"
          loading={updateSubscription.isPending}
          disabled={updateSubscription.isPending}
        >
          Update Seats
        </Button>
      </form>
    </Form>
  )
}
