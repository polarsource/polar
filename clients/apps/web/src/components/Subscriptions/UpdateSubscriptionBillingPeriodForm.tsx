'use client'

import { useUpdateSubscription } from '@/hooks/queries/subscriptions'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import DateTimePicker from '@polar-sh/ui/components/atoms/DateTimePicker'
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { subscriptionUpdateValidationDiscriminators } from './utils'

export const UpdateSubscriptionBillingPeriodForm = ({
  subscription,
  onUpdate,
}: {
  subscription: schemas['Subscription']
  onUpdate?: () => void
}) => {
  const updateSubscription = useUpdateSubscription(subscription.id)

  const minDate = useMemo<Date>(() => {
    const tomorrow = new Date()
    tomorrow.setHours(0, 0, 0, 0)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow
  }, [])

  const form = useForm<schemas['SubscriptionUpdateBillingPeriod']>({
    defaultValues: {
      current_billing_period_end: subscription.current_period_end || undefined,
    },
  })
  const { control, handleSubmit, setError } = form

  const onSubmit = useCallback(
    async (body: schemas['SubscriptionUpdateBillingPeriod']) => {
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
                title: 'Billing period update failed',
                description: `Error while updating billing period for ${subscription.product.name}: ${error.detail}`,
              })
            }
          return
        }

        toast({
          title: 'Billing period updated',
          description: `Billing period for ${subscription.product.name} has been successfully updated`,
        })
        onUpdate?.()
      })
    },
    [updateSubscription, subscription, setError, onUpdate],
  )

  return (
    <div className="dark:bg-polar-800 flex flex-col gap-y-4 rounded-2xl bg-gray-50 p-6">
      <div className="flex flex-col gap-y-2">
        <h3 className="text-lg font-medium">Update Billing Period</h3>
        <p className="dark:text-polar-500 mt-1 text-sm text-gray-500">
          Extend the current billing period by setting a new end date in the
          future. This is useful for providing additional free subscription time
          to a customer.
        </p>
      </div>

      <Form {...form}>
        <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
          <FormField
            control={control}
            name="current_billing_period_end"
            rules={{
              required: 'Please select a billing period end date',
              validate: (value) =>
                value !== subscription.current_period_end ||
                'Select a new end date to extend the billing period.',
            }}
            render={({ field }) => {
              return (
                <FormItem className="flex flex-col gap-y-2">
                  <FormLabel>Billing Period End Date</FormLabel>

                  <DateTimePicker
                    value={field.value}
                    onChange={field.onChange}
                    disabled={minDate ? { before: minDate } : undefined}
                  />

                  <FormMessage />
                  {field.value && (
                    <FormDescription>
                      The subscription will renew on the selected date and the
                      customer will be charged for the next billing period.
                    </FormDescription>
                  )}
                </FormItem>
              )
            }}
          />

          <Button
            type="submit"
            loading={updateSubscription.isPending}
            disabled={updateSubscription.isPending}
            className="w-fit"
          >
            Update Billing Period
          </Button>
        </form>
      </Form>
    </div>
  )
}
