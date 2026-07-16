'use client'

import {
  useSubscriptionCancelPreview,
  useUpdateSubscription,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Alert, Button, InlineModalHeader } from '@polar-sh/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import { TextArea } from '@polar-sh/orbit'
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
import { useForm, useWatch } from 'react-hook-form'
import { toast } from '../Toast/use-toast'

const CANCELLATION_REASONS: {
  [key: string]: string
} = {
  unused: 'Unused',
  too_expensive: 'Too Expensive',
  missing_features: 'Missing Features',
  switched_service: 'Switched Service',
  customer_service: 'Customer Service',
  low_quality: 'Low Quality',
  too_complex: 'Too Complicated',
  other: 'Other',
}

const getHumanCancellationReason = (key: string | null) => {
  if (key && key in CANCELLATION_REASONS) {
    return CANCELLATION_REASONS[key]
  }
  return null
}

type CancellationAction = 'revoke' | 'cancel_at_period_end'

type SubscriptionCancelForm = schemas['SubscriptionCancel'] & {
  cancellation_action: CancellationAction
}

interface CancelSubscriptionModalProps {
  subscription: schemas['Subscription']
  onCancellation?: () => void
  hide: () => void
}

const CancelSubscriptionModal = ({
  subscription,
  onCancellation,
  hide,
}: CancelSubscriptionModalProps) => {
  const cancelSubscription = useUpdateSubscription(subscription.id)
  const { data: cancelPreview } = useSubscriptionCancelPreview(
    subscription.id,
    {
      enabled: subscription.status === 'past_due',
    },
  )
  const form = useForm<SubscriptionCancelForm>({
    defaultValues: {
      cancellation_action: 'cancel_at_period_end',
      customer_cancellation_reason: undefined,
      customer_cancellation_comment: undefined,
    },
  })
  const { control, handleSubmit, setError, setValue } = form
  const cancellationAction = useWatch({ control, name: 'cancellation_action' })

  const stopsCollection =
    subscription.status === 'past_due' &&
    (cancelPreview?.stops_collection ?? false)

  // The warning only applies to immediate cancellation: ending at period end
  // keeps collecting the outstanding payment.
  const showStopsCollectionWarning =
    stopsCollection && cancellationAction === 'revoke'

  const onSubmit = useCallback(
    async (cancellation: SubscriptionCancelForm) => {
      const base = {
        customer_cancellation_reason: cancellation.customer_cancellation_reason,
        customer_cancellation_comment:
          cancellation.customer_cancellation_reason === 'other'
            ? cancellation.customer_cancellation_comment
            : undefined,
      }
      let body: schemas['SubscriptionRevoke'] | schemas['SubscriptionCancel']
      if (cancellation.cancellation_action === 'revoke') {
        body = {
          ...base,
          revoke: true,
        }
      } else {
        body = {
          ...base,
          cancel_at_period_end: true,
        }
      }

      await cancelSubscription.mutateAsync(body).then(({ error }) => {
        if (error) {
          if (error.detail)
            if (isValidationError(error.detail)) {
              setValidationErrors(error.detail, setError)
            } else {
              toast({
                title: 'Customer Update Failed',
                description: `Error cancelling subscription ${subscription.product.name}: ${error.detail}`,
              })
            }
          return
        }

        toast({
          title: 'Subscription Cancelled',
          description: `Subscription ${subscription.product.name} successfully cancelled`,
        })
        onCancellation?.()
      })
    },
    [subscription, cancelSubscription, setError, onCancellation],
  )

  const reasons = Object.keys(CANCELLATION_REASONS)
  let periodEndOutput: string | undefined = undefined
  if (subscription.current_period_end) {
    periodEndOutput = new Date(
      subscription.current_period_end,
    ).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <InlineModalHeader hide={hide}>
        <h2 className="text-xl">Cancel Subscription</h2>
      </InlineModalHeader>
      <div className="flex h-full flex-col gap-4 px-8 pb-12">
        <Form {...form}>
          <form
            className="flex grow flex-col justify-between gap-y-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex flex-col gap-y-6">
              {showStopsCollectionWarning && (
                <Alert
                  variant="warning"
                  title="This subscription has a failed payment"
                  description={
                    cancelPreview?.outstanding_amount != null
                      ? `Cancelling now ends it immediately and stops retrying that payment — the outstanding ${formatCurrency(
                          'standard',
                        )(
                          cancelPreview.outstanding_amount,
                          subscription.currency,
                        )} won't be collected.`
                      : 'Cancelling now ends it immediately and stops retrying that payment.'
                  }
                />
              )}
              <FormField
                control={control}
                name="cancellation_action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cancellation Date</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={(value: CancellationAction) => {
                          setValue('cancellation_action', value)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Cancellation Time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="revoke">Immediately</SelectItem>
                          <SelectItem value="cancel_at_period_end">
                            End of current period
                            {periodEndOutput && (
                              <>
                                {'  '}
                                <span>({periodEndOutput})</span>
                              </>
                            )}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="customer_cancellation_reason"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-y-2">
                    <div className="flex flex-col gap-2">
                      <FormLabel>Customer Feedback</FormLabel>
                      <FormDescription>
                        Did the customer specify why they wanted to cancel?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={undefined}
                      >
                        <SelectTrigger
                          className={
                            field.value
                              ? ''
                              : 'dark:text-polar-500 text-gray-400'
                          }
                        >
                          <SelectValue placeholder="Select customer cancellation reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(reasons).map((reason) => (
                            <SelectItem key={reason} value={reason}>
                              {getHumanCancellationReason(reason)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="customer_cancellation_comment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comment</FormLabel>
                    <FormControl>
                      <TextArea
                        {...field}
                        value={field.value ?? ''}
                        placeholder="Why is the customer cancelling?"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button
              type="submit"
              variant="destructive"
              size="lg"
              loading={cancelSubscription.isPending}
              disabled={cancelSubscription.isPending}
            >
              Cancel Subscription
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default CancelSubscriptionModal
