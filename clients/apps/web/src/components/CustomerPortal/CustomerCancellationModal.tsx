'use client'

import revalidate from '@/app/actions'
import {
  useCustomerCancelSubscription,
  useCustomerRevokeSubscription,
  useCustomerSubscriptionCancelPreview,
} from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import { Client, isValidationError, schemas } from '@polar-sh/client'
import { Alert, Button } from '@polar-sh/orbit'
import { TextArea } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import {
  RadioGroup,
  RadioGroupItem,
} from '@polar-sh/ui/components/ui/radio-group'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useForm, useFormState } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import { PortalDialog } from './PortalDialog'
import { PortalText } from './PortalPrimitives'

const CANCELLATION_REASONS: {
  value: schemas['CustomerCancellationReason']
  label: string
}[] = [
  { value: 'unused', label: 'Not using it enough' },
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'missing_features', label: 'Missing features' },
  { value: 'switched_service', label: 'Switched to another service' },
  { value: 'customer_service', label: 'Customer service' },
  { value: 'low_quality', label: 'Not satisfied with the quality' },
  { value: 'too_complex', label: 'Too complicated' },
  { value: 'other', label: 'Other' },
]

interface CustomerCancellationModalProps {
  isShown: boolean
  hide: () => void
  api: Client
  subscription: schemas['CustomerSubscription']
  cancelSubscription: ReturnType<typeof useCustomerCancelSubscription>
}

const CancellationDialog = ({
  api,
  subscription,
  cancelSubscription,
  ...props
}: Omit<CustomerCancellationModalProps, 'isShown'>) => {
  const router = useRouter()

  const { data: cancelPreview } = useCustomerSubscriptionCancelPreview(
    api,
    subscription.id,
    subscription.status === 'past_due',
  )

  const revokeSubscription = useCustomerRevokeSubscription(api)

  // Past-due with no grace period: cancelling stops collection, so revoke
  // immediately instead of scheduling a cancellation at period end.
  const stopsCollection =
    subscription.status === 'past_due' && !!cancelPreview?.stops_collection

  // Block submission until the preview has loaded successfully. Otherwise a fast
  // click — or a failed preview request — would fall back to the
  // cancel-at-period-end path on a subscription that should be revoked, leaving
  // dunning running.
  const previewPending = subscription.status === 'past_due' && !cancelPreview

  const isPending = cancelSubscription.isPending || revokeSubscription.isPending
  const noun = subscription.status === 'trialing' ? 'trial' : 'subscription'

  const handleCancel = useCallback(() => {
    props.hide()
  }, [props])

  const form = useForm<schemas['CustomerSubscriptionCancel']>({
    defaultValues: {
      cancel_at_period_end: true,
      cancellation_reason: undefined,
      cancellation_comment: undefined,
    },
  })
  const { errors } = useFormState({ control: form.control })
  const { control, handleSubmit, setError, setValue } = form

  const handleCancellation = useCallback(
    async (cancellation: schemas['CustomerSubscriptionCancel']) => {
      const { error } = stopsCollection
        ? await revokeSubscription.mutateAsync({
            id: subscription.id,
            body: {
              cancellation_reason: cancellation.cancellation_reason,
              cancellation_comment: cancellation.cancellation_comment,
            },
          })
        : await cancelSubscription.mutateAsync({
            id: subscription.id,
            body: cancellation,
          })

      await revalidate(`customer_portal`)

      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          setError('root', { message: error.detail })
        }
        return
      }
      toast({
        title: noun === 'trial' ? 'Trial canceled' : 'Subscription canceled',
        description: `Your ${noun} has been canceled.`,
      })
      router.refresh()
      props.hide()
    },
    [
      subscription.id,
      stopsCollection,
      cancelSubscription,
      revokeSubscription,
      setError,
      props,
      router,
      noun,
    ],
  )

  const onReasonSelect = (value: schemas['CustomerCancellationReason']) => {
    setValue('cancellation_reason', value ?? '')
  }

  return (
    <PortalDialog
      isShown
      hide={props.hide}
      title={`Cancel ${noun}`}
      description="We're sorry to see you go. Let us know why you're leaving so we can improve."
      actions={
        <>
          <Button variant="ghost" onClick={handleCancel}>
            Keep {noun}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit(handleCancellation)}
            loading={isPending}
            disabled={isPending || previewPending}
          >
            {stopsCollection ? 'Cancel now' : `Cancel ${noun}`}
          </Button>
        </>
      }
    >
      {subscription.status === 'past_due' &&
        cancelPreview?.stops_collection && (
          <Alert
            variant="warning"
            title="Your latest payment didn't go through"
            description="Cancelling now ends your subscription immediately and stops any further payment attempts."
          />
        )}
      <Form {...form}>
        <form
          className="flex flex-col gap-y-6"
          onSubmit={handleSubmit(handleCancellation)}
        >
          <FormField
            control={control}
            name="cancellation_reason"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    value={field.value ?? undefined}
                    onValueChange={onReasonSelect}
                    className="gap-y-3"
                  >
                    {CANCELLATION_REASONS.map(({ value, label }) => (
                      <Box
                        as="label"
                        key={value}
                        htmlFor={`reason-${value}`}
                        display="flex"
                        alignItems="center"
                        columnGap="m"
                        cursor="pointer"
                      >
                        <RadioGroupItem
                          value={value}
                          id={`reason-${value}`}
                          className="dark:border-polar-600 border-gray-300 text-black data-[state=checked]:border-black dark:text-white dark:data-[state=checked]:border-white"
                        />
                        <PortalText className="text-sm">{label}</PortalText>
                      </Box>
                    ))}
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
              <FormItem>
                <FormControl>
                  <TextArea
                    {...field}
                    value={field.value || ''}
                    placeholder="Anything else you want to share? (optional)"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {errors.root && (
            <PortalText tone="danger" className="text-sm">
              {errors.root.message}
            </PortalText>
          )}
        </form>
      </Form>
    </PortalDialog>
  )
}

const CustomerCancellationModal = ({
  isShown,
  ...props
}: CustomerCancellationModalProps) =>
  isShown ? <CancellationDialog {...props} /> : null

export default CustomerCancellationModal
