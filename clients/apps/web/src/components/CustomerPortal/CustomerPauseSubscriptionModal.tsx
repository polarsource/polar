'use client'

import { toast } from '@/components/Toast/use-toast'
import { useCustomerPauseSubscription } from '@/hooks/queries/customerPortal'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { Client, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
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
import { PortalDialog } from './PortalDialog'

interface CustomerPauseSubscriptionModalProps {
  isShown: boolean
  hide: () => void
  api: Client
  subscription: schemas['CustomerSubscription']
  onPause?: () => void
}

const CustomerPauseSubscriptionModal = ({
  isShown,
  hide,
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
        title: 'Subscription paused',
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
    <PortalDialog
      isShown={isShown}
      hide={hide}
      title="Pause subscription"
      description="Your subscription stays active until the end of the current period. While paused you won't be charged and benefits are revoked until it resumes."
      actions={
        <>
          <Button variant="ghost" onClick={hide}>
            Keep active
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            loading={pauseSubscription.isPending}
          >
            Pause subscription
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="resumes_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resume date (optional)</FormLabel>
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={
                    periodEnd ? [{ before: periodEnd }, periodEnd] : undefined
                  }
                />
                <FormDescription>
                  Leave empty to pause until you resume manually. Must be after
                  the current period ends.
                </FormDescription>
              </FormItem>
            )}
          />
        </form>
      </Form>
    </PortalDialog>
  )
}

export default CustomerPauseSubscriptionModal
