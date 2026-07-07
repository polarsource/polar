'use client'

import { toast } from '@/components/Toast/use-toast'
import { useCustomerPauseSubscription } from '@/hooks/queries/customerPortal'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { Client, schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import DatePicker from '@polar-sh/ui/components/atoms/DateTimePicker'
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'

interface CustomerPauseSubscriptionModalProps {
  api: Client
  subscription: schemas['CustomerSubscription']
  onPause?: () => void
}

const CustomerPauseSubscriptionModal = ({
  api,
  subscription,
  onPause,
}: CustomerPauseSubscriptionModalProps) => {
  const router = useRouter()
  const form = useForm<{ resumes_at?: string }>({
    defaultValues: { resumes_at: undefined },
  })
  const pauseSubscription = useCustomerPauseSubscription(api)

  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : undefined

  const onSubmit = async ({ resumes_at }: { resumes_at?: string }) => {
    try {
      await pauseSubscription.mutateAsync({
        id: subscription.id,
        body: { pause_at_period_end: true, resumes_at: resumes_at || null },
      })
      router.refresh()
      toast({
        title: 'Subscription Paused',
        description: resumes_at
          ? 'Your subscription will be paused at the end of the current period and resume automatically on the selected date.'
          : 'Your subscription will be paused at the end of the current period.',
      })
      onPause?.()
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to pause the subscription: ${extractApiErrorMessage(error as Record<string, unknown>)}`,
      })
    }
  }

  return (
    <Box
      flexDirection="column"
      rowGap="xl"
      padding="2xl"
      height="100%"
      overflowY="auto"
    >
      <Text variant="heading-xs" as="h2">
        Pause Subscription
      </Text>
      <Text color="muted">
        Your subscription stays active until the end of the current period. At
        the next renewal it is paused — you are not charged and benefits are
        revoked until it resumes.
      </Text>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6"
        >
          <FormField
            control={form.control}
            name="resumes_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resume date (optional)</FormLabel>
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={periodEnd ? { before: periodEnd } : undefined}
                />
                <FormDescription>
                  Leave empty to pause indefinitely until you resume manually.
                  Must be after the current period ends.
                </FormDescription>
              </FormItem>
            )}
          />
          <Button type="submit" loading={pauseSubscription.isPending}>
            Pause Subscription
          </Button>
        </form>
      </Form>
    </Box>
  )
}

export default CustomerPauseSubscriptionModal
