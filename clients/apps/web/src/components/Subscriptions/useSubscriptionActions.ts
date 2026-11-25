import { toast } from '@/components/Toast/use-toast'
import {
  useCancelScheduledPause,
  useResumeSubscription,
  useUncancelSubscription,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'

interface SubscriptionAction {
  run: () => Promise<void>
  isPending: boolean
}

// The mutations throw an Error that already carries the server's message.
const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : extractApiErrorMessage(error as Record<string, unknown>)

const runWithToast = async (
  mutate: () => Promise<unknown>,
  success: { title: string; description: string },
  failure: string,
) => {
  try {
    await mutate()
    toast(success)
  } catch (error) {
    toast({
      title: 'Error',
      description: `${failure}: ${getErrorMessage(error)}`,
    })
  }
}

// The one-click changes to a subscription, shared by the actions menu and the
// callout at the top of its page.
export const useSubscriptionActions = (
  subscriptionId: string,
): Record<
  'uncancel' | 'resume' | 'cancelScheduledPause',
  SubscriptionAction
> => {
  const uncancel = useUncancelSubscription(subscriptionId)
  const resume = useResumeSubscription(subscriptionId)
  const cancelScheduledPause = useCancelScheduledPause(subscriptionId)

  return {
    uncancel: {
      isPending: uncancel.isPending,
      run: () =>
        runWithToast(
          () => uncancel.mutateAsync(),
          {
            title: 'Subscription Uncanceled',
            description:
              'The subscription has been uncanceled and will continue at the next billing cycle.',
          },
          'Failed to uncancel the subscription',
        ),
    },
    resume: {
      isPending: resume.isPending,
      run: () =>
        runWithToast(
          () => resume.mutateAsync(),
          {
            title: 'Subscription Resumed',
            description:
              'The subscription has been resumed and charged for a new billing period.',
          },
          'Failed to resume the subscription',
        ),
    },
    cancelScheduledPause: {
      isPending: cancelScheduledPause.isPending,
      run: () =>
        runWithToast(
          () => cancelScheduledPause.mutateAsync(),
          {
            title: 'Scheduled Pause Canceled',
            description:
              'The subscription will no longer be paused at the end of the period.',
          },
          'Failed to cancel the scheduled pause',
        ),
    },
  }
}
