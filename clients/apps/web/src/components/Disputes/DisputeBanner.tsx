'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useAcceptDispute } from '@/hooks/queries/disputes'
import { getDisputeReasonExplanation } from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const DISPUTE_DOCS_URL =
  'https://polar.sh/docs/merchant-of-record/fees#dispute/chargeback-fees'

export const DisputeBanner = ({ dispute }: { dispute: schemas['Dispute'] }) => {
  const accepted = dispute.status === 'accepted'
  const needsResponse = dispute.status === 'needs_response'
  const acceptModal = useModal()
  const acceptDispute = useAcceptDispute()

  return (
    <Box
      flexDirection="column"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-primary"
      overflow="hidden"
    >
      <Box flexDirection="column" rowGap="m" padding="xl">
        <Text variant="heading-xxs" as="h3">
          {accepted
            ? 'You accepted this dispute'
            : 'The customer disputed this payment'}
        </Text>
        <Text color="muted">
          {accepted
            ? 'The disputed amount and the dispute fee will be deducted from your balance. No further action is needed.'
            : getDisputeReasonExplanation(dispute.reason)}
        </Text>
        {needsResponse && (
          <Text color="muted">
            You can accept this dispute to refund the customer and close it.
          </Text>
        )}
      </Box>

      {needsResponse && (
        <Box
          alignItems="center"
          justifyContent="between"
          columnGap="m"
          padding="l"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <a
            href={DISPUTE_DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline"
          >
            Learn more about dispute fees
          </a>
          <Button onClick={acceptModal.show}>Accept dispute</Button>
        </Box>
      )}

      <ConfirmModal
        isShown={acceptModal.isShown}
        hide={acceptModal.hide}
        title="Accept the dispute?"
        description="Conceding the chargeback refunds the customer. The amount and fees are deducted from your balance."
        onConfirm={async () => {
          try {
            await acceptDispute.mutateAsync(dispute.id)
          } catch {
            toast({
              title: 'Something went wrong',
              description: 'Could not accept the dispute. Please try again.',
            })
          }
        }}
      />
    </Box>
  )
}
