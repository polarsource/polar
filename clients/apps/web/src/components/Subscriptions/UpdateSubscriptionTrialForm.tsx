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
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { useModal } from '../Modal/useModal'
import { toast } from '../Toast/use-toast'
import { subscriptionUpdateValidationDiscriminators } from './utils'

export const UpdateSubscriptionTrialForm = ({
  subscription,
  onUpdate,
}: {
  subscription: schemas['Subscription']
  onUpdate?: () => void
}) => {
  const updateSubscription = useUpdateSubscription(subscription.id)
  const [isEndingTrial, setIsEndingTrial] = useState(false)
  const {
    show: showConfirmModal,
    hide: hideConfirmModal,
    isShown: isConfirmModalShown,
  } = useModal()

  const minDate = useMemo<Date | undefined>(() => {
    if (subscription.status === 'trialing' && subscription.trial_start) {
      return new Date(subscription.trial_start)
    }
    if (subscription.current_period_end) {
      return new Date(subscription.current_period_end)
    }
    return undefined
  }, [subscription])

  const form = useForm<schemas['SubscriptionUpdateBase']>({
    defaultValues: {
      trial_end: subscription.trial_end || undefined,
    },
  })
  const { control, handleSubmit, setError, reset } = form

  const handleEndTrialNow = useCallback(async () => {
    setIsEndingTrial(true)
    try {
      await updateSubscription
        .mutateAsync({ trial_end: 'now' })
        .then(({ error }) => {
          if (error) {
            if (error.detail) {
              if (isValidationError(error.detail)) {
                setValidationErrors(
                  error.detail,
                  setError,
                  undefined,
                  subscriptionUpdateValidationDiscriminators,
                )
              } else {
                toast({
                  title: 'Trial end failed',
                  description: `Error while ending trial for ${subscription.product.name}: ${error.detail}`,
                })
              }
            }
            return
          }

          toast({
            title: 'Trial ended',
            description: `Trial for ${subscription.product.name} has been ended. Customer will be billed immediately.`,
          })
          onUpdate?.()
          hideConfirmModal()
        })
    } finally {
      setIsEndingTrial(false)
    }
  }, [updateSubscription, subscription, setError, onUpdate, hideConfirmModal])

  const onSubmit = useCallback(
    async (body: schemas['SubscriptionUpdateBase']) => {
      if (body.trial_end === 'now') {
        return
      }

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
                title: 'Trial update failed',
                description: `Error while updating trial for ${subscription.product.name}: ${error.detail}`,
              })
            }
          return
        }

        toast({
          title: 'Trial updated',
          description: `Trial for ${subscription.product.name} has been successfully updated`,
        })
        onUpdate?.()
        reset({ trial_end: body.trial_end })
      })
    },
    [updateSubscription, subscription, setError, onUpdate, reset],
  )

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="dark:bg-polar-800 flex flex-col gap-y-4 rounded-2xl bg-gray-50 p-6">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-lg font-medium">
              {subscription.status === 'trialing'
                ? 'Update Trial'
                : 'Add Trial Period'}
            </h3>
            <p className="dark:text-polar-500 mt-1 text-sm text-gray-500">
              {subscription.status === 'trialing'
                ? 'Set a new trial end date to extend or reduce the current trial period.'
                : 'Add a trial period by setting a trial end date in the future.'}
            </p>
          </div>

          <Form {...form}>
            <form
              className="flex flex-col gap-6"
              onSubmit={handleSubmit(onSubmit)}
            >
              <FormField
                control={control}
                name="trial_end"
                render={({ field }) => {
                  return (
                    <FormItem className="flex flex-col gap-y-2">
                      <FormLabel>Trial End Date</FormLabel>

                      <DateTimePicker
                        value={
                          field.value === 'now'
                            ? undefined
                            : field.value || undefined
                        }
                        onChange={field.onChange}
                        disabled={minDate ? { before: minDate } : undefined}
                      />

                      <FormMessage />
                      {field.value && field.value !== 'now' && (
                        <FormDescription>
                          The trial will end on the selected date and the
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
                Update Trial
              </Button>
            </form>
          </Form>
        </div>

        {subscription.status === 'trialing' && (
          <div className="dark:bg-polar-800 flex flex-col items-start gap-y-4 rounded-2xl bg-gray-50 p-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">End Trial</h3>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                This will immediately end the trial period and charge the
                customer for a new billing cycle.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={showConfirmModal}
              disabled={isEndingTrial}
              loading={isEndingTrial}
            >
              End Trial
            </Button>
          </div>
        )}
      </div>

      <ConfirmModal
        isShown={isConfirmModalShown}
        hide={hideConfirmModal}
        title="End Trial"
        description="This action will immediately end the trial period and charge the customer for a new billing cycle. This cannot be undone."
        destructive={true}
        destructiveText="End Trial"
        onConfirm={handleEndTrialNow}
        onCancel={hideConfirmModal}
      />
    </>
  )
}
