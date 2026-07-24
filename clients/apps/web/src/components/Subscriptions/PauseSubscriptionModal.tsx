'use client'

import { toast } from '@/components/Toast/use-toast'
import { usePauseSubscription } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import { InlineModalHeader, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PauseSubscriptionForm } from './PauseSubscriptionForm'

interface PauseSubscriptionModalProps {
  subscription: schemas['Subscription']
  onPause?: () => void
  hide: () => void
}

const PauseSubscriptionModal = ({
  subscription,
  onPause,
  hide,
}: PauseSubscriptionModalProps) => {
  const pauseSubscription = usePauseSubscription(subscription.id)

  const onSubmit = async (resumesAt: string | null) => {
    try {
      await pauseSubscription.mutateAsync({ resumes_at: resumesAt })
      toast({
        title: 'Subscription Paused',
        description:
          'The subscription will be paused at the end of the current period.',
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
    <Box flexDirection="column" height="100%" overflowY="auto">
      <InlineModalHeader hide={hide}>
        <Text variant="heading-xs" as="h2">
          Pause Subscription
        </Text>
      </InlineModalHeader>
      <Box
        flexDirection="column"
        rowGap="xl"
        paddingHorizontal="2xl"
        paddingBottom="2xl"
      >
        <Text color="muted">
          The subscription stays active until the end of the current period. At
          the next renewal it is paused — no charge is made and benefits are
          revoked until it resumes.
        </Text>
        <PauseSubscriptionForm
          currentPeriodEnd={subscription.current_period_end}
          isPending={pauseSubscription.isPending}
          onSubmit={onSubmit}
        />
      </Box>
    </Box>
  )
}

export default PauseSubscriptionModal
