'use client'

import { toast } from '@/components/Toast/use-toast'
import { useCustomerPauseSubscription } from '@/hooks/queries/customerPortal'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { Client, schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { PauseSubscriptionForm } from '../Subscriptions/PauseSubscriptionForm'

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
  const pauseSubscription = useCustomerPauseSubscription(api)

  const onSubmit = async (resumesAt: string | null) => {
    try {
      await pauseSubscription.mutateAsync({
        id: subscription.id,
        body: { pause_at_period_end: true, resumes_at: resumesAt },
      })
      router.refresh()
      toast({
        title: 'Subscription Paused',
        description: resumesAt
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
      <PauseSubscriptionForm
        currentPeriodEnd={subscription.current_period_end}
        isPending={pauseSubscription.isPending}
        onSubmit={onSubmit}
      />
    </Box>
  )
}

export default CustomerPauseSubscriptionModal
