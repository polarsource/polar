'use client'

import revalidate from '@/app/actions'
import { Modal, ModalProps } from '@polar-sh/orbit'
import {
  useCustomerCancelSubscription,
  useCustomerRevokeSubscription,
  useCustomerSubscriptionCancelPreview,
} from '@/hooks/queries/customerPortal'
import { setValidationErrors } from '@/utils/api/errors'
import { Client, isValidationError, schemas } from '@polar-sh/client'
import { Alert, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { TextArea } from '@polar-sh/orbit'
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
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'

const CancellationReasonRadio = ({
  value,
  label,
}: {
  value: schemas['CustomerCancellationReason']
  label: string
}) => {
  return (
    <Box alignItems="center" columnGap="l">
      <RadioGroupItem value={value} id={`reason-${value}`} />
      <Box flexGrow={1}>
        <Label htmlFor={`reason-${value}`}>{label}</Label>
      </Box>
    </Box>
  )
}

interface CustomerCancellationModalProps extends Omit<
  ModalProps,
  'title' | 'modalContent'
> {
  api: Client
  subscription: schemas['CustomerSubscription']
  cancelSubscription: ReturnType<typeof useCustomerCancelSubscription>
}

const CustomerCancellationModal = ({
  api,
  subscription,
  cancelSubscription,
  ...props
}: CustomerCancellationModalProps) => {
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
        title: 'Subscription Cancelled',
        description: `Subscription was cancelled successfully`,
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
    ],
  )

  const onReasonSelect = (value: schemas['CustomerCancellationReason']) => {
    setValue('cancellation_reason', value ?? '')
  }

  return (
    <Modal
      {...props}
      title="Cancel Subscription"
      className="md:min-w-[600px]"
      modalContent={
        <Box
          flexDirection="column"
          rowGap="xl"
          padding={{ base: 'xl', sm: '3xl' }}
        >
          <Box flexDirection="column" rowGap="s">
            <Text variant="heading-s" as="h3">
              We&apos;re sorry to see you go
            </Text>
            <Text color="muted" wrap="balance">
              You&apos;re always welcome back. Let us know why you&apos;re
              leaving to help us improve our product.
            </Text>
          </Box>
          {subscription.status === 'past_due' &&
            cancelPreview?.stops_collection && (
              <Alert
                variant="warning"
                title="Your latest payment didn't go through"
                description="Cancelling now ends your subscription immediately and stops any further payment attempts."
              />
            )}
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
                  <FormItem className="mt-6">
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
              <Box
                flexDirection={{ base: 'column', sm: 'row' }}
                gap="l"
                paddingTop="xl"
              >
                <Button
                  type="submit"
                  variant="destructive"
                  loading={isPending}
                  disabled={isPending || previewPending}
                >
                  {stopsCollection ? 'Cancel now' : 'Cancel subscription'}
                </Button>
                <Button variant="ghost" onClick={handleCancel}>
                  I&apos;ve changed my mind
                </Button>
              </Box>
            </form>
          </Form>
        </Box>
      }
    />
  )
}

export default CustomerCancellationModal
