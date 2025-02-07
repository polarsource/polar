'use client'

import { Modal, ModalProps } from '@/components/Modal'
import { useCustomerCancelSubscription } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { components, isValidationError } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Label } from '@polar-sh/ui/components/ui/label'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'

const CancellationReasonRadio = ({
  value,
  label,
}: {
  value: components['schemas']['CustomerCancellationReason']
  label: string
}) => {
  return (
    <div className="flex flex-row">
      <RadioGroupItem value={value} id={`reason-${value}`} />
      <Label className="ml-4 grow" htmlFor={`reason-${value}`}>
        {label}
      </Label>
    </div>
  )
}

interface CustomerCancellationModalProps
  extends Omit<ModalProps, 'modalContent'> {
  subscription: components['schemas']['CustomerSubscription']
  cancelSubscription: ReturnType<typeof useCustomerCancelSubscription>
  onAbort?: () => void
}

const CustomerCancellationModal = ({
  subscription,
  cancelSubscription,
  onAbort,
  ...props
}: CustomerCancellationModalProps) => {
  const handleCancel = useCallback(() => {
    onAbort?.()
    props.hide()
  }, [onAbort, props])

  const form = useForm<components['schemas']['CustomerSubscriptionCancel']>({
    defaultValues: {
      cancel_at_period_end: true,
      cancellation_reason: undefined,
      cancellation_comment: undefined,
    },
  })
  const { control, handleSubmit, setError, setValue } = form

  const handleCancellation = useCallback(
    async (
      cancellation: components['schemas']['CustomerSubscriptionCancel'],
    ) => {
      const { error } = await cancelSubscription.mutateAsync({
        id: subscription.id,
        body: cancellation,
      })
      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          setError('root', { message: error.detail })
        }
        return
      }
      toast({
        title: 'Subscription Cancelled',
        description: `Subscription was cancelled successfully`,
      })
      props.hide()
    },
    [subscription.id, cancelSubscription, setError, props],
  )

  const onReasonSelect = (
    value: components['schemas']['CustomerCancellationReason'],
  ) => {
    setValue('cancellation_reason', value ?? '')
  }

  return (
    <Modal
      {...props}
      className="md:min-w-[600px]"
      modalContent={
        <div className="flex flex-col gap-y-6 p-12">
          <div className="flex flex-col gap-y-2">
            <h3 className="text-2xl">We&apos;re sorry to see you go!</h3>
            <p className="dark:text-polar-500 text-balance leading-relaxed text-gray-500">
              You&apos;re always welcome back! Let us know why you&apos;re
              leaving to help us improve our product.
            </p>
          </div>
          <Form {...form}>
            <form onSubmit={handleSubmit(handleCancellation)}>
              <FormField
                control={control}
                name="cancellation_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        value={field.value ?? 'other'}
                        onValueChange={onReasonSelect}
                      >
                        <CancellationReasonRadio
                          value="unused"
                          label="Not using it enough"
                        />
                        <CancellationReasonRadio
                          value="too_expensive"
                          label="Too expensive"
                        />
                        <CancellationReasonRadio
                          value="missing_features"
                          label="Missing features"
                        />
                        <CancellationReasonRadio
                          value="switched_service"
                          label="Switched to another service"
                        />
                        <CancellationReasonRadio
                          value="customer_service"
                          label="Customer service"
                        />
                        <CancellationReasonRadio
                          value="low_quality"
                          label="Not satisfied with the quality"
                        />
                        <CancellationReasonRadio
                          value="too_complex"
                          label="Too complicated"
                        />
                        <CancellationReasonRadio
                          value="other"
                          label="Other (please share below)"
                        />
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="cancellation_comment"
                render={({ field }) => (
                  <FormItem className="mt-8">
                    <FormControl>
                      <TextArea
                        {...field}
                        value={field.value || ''}
                        placeholder="Anything else you want to share? (Optional)"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-row gap-x-4 pt-6">
                <Button
                  type="submit"
                  variant="destructive"
                  loading={cancelSubscription.isPending}
                  disabled={cancelSubscription.isPending}
                >
                  Cancel Subscription
                </Button>
                <Button variant="ghost" onClick={handleCancel}>
                  I&apos;ve changed my mind
                </Button>
              </div>
            </form>
          </Form>
        </div>
      }
    />
  )
}

export default CustomerCancellationModal
