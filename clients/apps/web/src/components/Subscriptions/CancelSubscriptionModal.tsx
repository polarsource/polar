'use client'

import { useUpdateSubscription } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  ResponseError,
  Subscription,
  SubscriptionCancel,
  ValidationError,
} from '@polar-sh/api'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
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

interface SubscriptionCancelForm extends SubscriptionCancel {
  cancellation_action: CancellationAction
}

interface CancelSubscriptionModalProps {
  subscription: Subscription
  onCancellation?: () => void
}

const CancelSubscriptionModal = ({
  subscription,
  onCancellation,
}: CancelSubscriptionModalProps) => {
  const cancelSubscription = useUpdateSubscription(subscription.id)
  const form = useForm<SubscriptionCancelForm>({
    defaultValues: {
      cancellation_action: 'cancel_at_period_end',
      customer_cancellation_reason: undefined,
    },
  })
  const { control, handleSubmit, setError, setValue } = form

  const onSubmit = useCallback(
    async (cancellation: SubscriptionCancelForm) => {
      try {
        let body: SubscriptionCancel = {
          customer_cancellation_reason:
            cancellation.customer_cancellation_reason,
        }
        if (cancellation.cancellation_action === 'revoke') {
          body.revoke = true
        } else {
          body.cancel_at_period_end = true
        }

        await cancelSubscription
          .mutateAsync(body)
          .then(() => {
            toast({
              title: 'Subscription Cancelled',
              description: `Subscription ${subscription.product.name} successfully cancelled`,
            })
            onCancellation?.()
          })
          .catch((error) => {
            toast({
              title: 'Subscription Cancellation Failed',
              description: `Error cancelling subscription ${subscription.product.name}: ${error.message}`,
            })
          })
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
          } else {
            setError('root', { message: e.message })
          }
        }
      }
    },
    [cancelSubscription, subscription.id, setError, onCancellation],
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
    <div className="flex h-full flex-col gap-8 overflow-y-auto px-8 py-12">
      <div className="flex flex-row items-center gap-x-4">
        <h2 className="text-xl">Cancel Subscription</h2>
      </div>
      <div className="flex h-full flex-col gap-4">
        <Form {...form}>
          <form
            className="flex flex-grow flex-col justify-between gap-y-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex flex-col gap-y-6">
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
                        <SelectTrigger>
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
            </div>
            <Button type="submit" variant={'destructive'} size="lg">
              Cancel Subscription
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default CancelSubscriptionModal
