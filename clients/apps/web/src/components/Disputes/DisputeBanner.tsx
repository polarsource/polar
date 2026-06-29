'use client'

import { toast } from '@/components/Toast/use-toast'
import { getDisputeReasonExplanation } from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const DISPUTE_DOCS_URL =
  'https://polar.sh/docs/merchant-of-record/fees#dispute/chargeback-fees'

export const DisputeBanner = ({ dispute }: { dispute: schemas['Dispute'] }) => {
  const needsResponse = dispute.status === 'needs_response'

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
            You may either provide evidence that clarifies the transaction to
            help your customer recognize it, or accept this dispute immediately
            to refund the customer and close the dispute.
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
          <Box alignItems="center" columnGap="s">
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  title: 'Coming soon',
                  description: 'Accepting disputes isn’t available yet.',
                })
              }
            >
              Accept dispute
            </Button>
            <Button
              onClick={() =>
                toast({
                  title: 'Coming soon',
                  description: 'Countering disputes isn’t available yet.',
                })
              }
            >
              Counter dispute
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  )
}
