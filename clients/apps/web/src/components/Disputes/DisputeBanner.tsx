'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import { toast } from '@/components/Toast/use-toast'
import { useAcceptDispute } from '@/hooks/queries/disputes'
import { getDisputeReasonExplanation } from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'

const DISPUTE_DOCS_URL =
  'https://polar.sh/docs/merchant-of-record/fees#dispute/chargeback-fees'

export const DisputeBanner = ({
  dispute,
  organization,
}: {
  dispute: schemas['Dispute']
  organization: schemas['Organization']
}) => {
  const needsResponse = dispute.status === 'needs_response'
  const acceptModal = useModal()
  const acceptDispute = useAcceptDispute()
  const respondPath = `/dashboard/${organization.slug}/sales/disputes/${dispute.id}/respond`

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
          The customer disputed this payment
        </Text>
        <Text color="muted">{getDisputeReasonExplanation(dispute.reason)}</Text>
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
          <Box flexDirection="row" alignItems="center" columnGap="m">
            <Button
              variant="secondary"
              onClick={acceptModal.show}
              loading={acceptDispute.isPending}
            >
              Accept dispute
            </Button>
            <Link href={respondPath}>
              <Button>Counter dispute</Button>
            </Link>
          </Box>
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
