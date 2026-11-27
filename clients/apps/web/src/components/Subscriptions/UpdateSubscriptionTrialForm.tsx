'use client'

import { useUpdateSubscription } from '@/hooks/queries/subscriptions'
import { extractApiErrorMessage, setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
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
import { useForm, useFormState } from 'react-hook-form'
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

  const minDate = useMemo<Date>(() => {
    const tomorrow = new Date()
    tomorrow.setHours(0, 0, 0, 0)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow
  }, [])

  const form = useForm<schemas['SubscriptionUpdateBase']>({
    defaultValues: {
      trial_end: subscription.trial_end || undefined,
    },
  })
  const { control, handleSubmit, setError, reset } = form
  const { isDirty } = useFormState({ control })

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
                  description: `Error while ending trial for ${subscription.product.name}: ${extractApiErrorMessage(error)}`,
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
                description: `Error while updating trial for ${subscription.product.name}: ${extractApiErrorMessage(error)}`,
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
      <Form {...form}>
        <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
          <FormField
            control={control}
            name="trial_end"
            rules={{ required: 'Please select a trial end date' }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Trial End Date</FormLabel>

                  <DateTimePicker
                    value={
                      field.value === 'now'
                        ? undefined
                        : field.value || undefined
                    }
                    onChange={field.onChange}
                    disabled={{ before: minDate }}
                  />

                  <FormMessage />
                  {field.value && field.value !== 'now' && (
                    <FormDescription>
                      The trial will end on the selected date and the customer
                      will be charged for the next billing period.
                    </FormDescription>
                  )}
                </FormItem>
              )
            }}
          />

          <Box columnGap="s">
            <Button
              type="submit"
              loading={updateSubscription.isPending}
              disabled={!isDirty || updateSubscription.isPending}
            >
              Update trial end date
            </Button>
            <Button
              variant="destructive"
              onClick={showConfirmModal}
              disabled={isEndingTrial}
              loading={isEndingTrial}
            >
              End trial now
            </Button>
          </Box>
        </form>
      </Form>

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
