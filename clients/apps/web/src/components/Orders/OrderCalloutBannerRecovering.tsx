import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ExternalLinkIcon } from 'lucide-react'

const FAILED_PAYMENTS_DOCS_URL =
  'https://docs.polar.sh/features/subscriptions/failed-payments'

interface OrderCalloutBannerRecoveringProps {
  lastAttemptAt: string | null
  declineMessage: string | null | undefined
  nextAttemptAt: string | null
  revocationDeadline: Date | null
  benefitsRevocationDate: Date | null
  benefitsRevoked: boolean
}

export const OrderCalloutBannerRecovering = ({
  lastAttemptAt,
  declineMessage,
  nextAttemptAt,
  revocationDeadline,
  benefitsRevocationDate,
  benefitsRevoked,
}: OrderCalloutBannerRecoveringProps) => (
  <Box flexDirection="column" rowGap="l">
    <Text variant="heading-xxs">Payment Failed</Text>

    <Box
      display="grid"
      gridTemplateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }}
      borderColor="border-primary"
      borderWidth={1}
      borderStyle="solid"
      borderRadius="l"
    >
      <Box
        flexDirection="column"
        rowGap="m"
        paddingVertical="xl"
        paddingHorizontal="xl"
      >
        <Box flexDirection="column" rowGap="xs">
          <Text color="muted">Last attempt</Text>
          {lastAttemptAt ? (
            <Text variant="body">
              <FormattedDateTime resolution="time" datetime={lastAttemptAt} />
            </Text>
          ) : null}
        </Box>
        {declineMessage ? (
          <Box
            flexDirection="column"
            rowGap="xs"
            backgroundColor="background-card"
            borderRadius="s"
            padding="l"
          >
            <Text variant="caption" color="muted">
              Bank Decline Reason
            </Text>
            <Text>{declineMessage}</Text>
          </Box>
        ) : null}
      </Box>

      <Box
        flexDirection="column"
        rowGap="m"
        paddingVertical="xl"
        paddingHorizontal="xl"
        borderTopWidth={{ base: 1, lg: 0 }}
        borderLeftWidth={{ base: 0, lg: 1 }}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box flexDirection="column" rowGap="xs">
          <Text color="muted">Next attempt</Text>
          {nextAttemptAt ? (
            <Text variant="body">
              <FormattedDateTime resolution="day" datetime={nextAttemptAt} />
            </Text>
          ) : null}
        </Box>
        <Text>
          Polar always tries to recover failed subscription payments for you.
        </Text>
        <a
          href={FAILED_PAYMENTS_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit"
        >
          <Box
            as="span"
            display="inline-flex"
            alignItems="center"
            columnGap="xs"
          >
            <Text as="span">
              <span className="underline">Learn more</span>
            </Text>
            <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
          </Box>
        </a>
      </Box>

      <Box
        flexDirection="column"
        rowGap="m"
        paddingVertical="xl"
        paddingHorizontal="xl"
        borderTopWidth={{ base: 1, lg: 0 }}
        borderLeftWidth={{ base: 0, lg: 1 }}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box flexDirection="column" rowGap="xs">
          <Text color="muted">What happens next</Text>
          {revocationDeadline ? (
            <Text variant="body">
              <FormattedDateTime
                resolution="day"
                datetime={revocationDeadline}
              />
            </Text>
          ) : null}
        </Box>
        <Text>
          If we can&apos;t recover the payment, the subscription will be canceled
          {revocationDeadline ? (
            <>
              {' on '}
              <FormattedDateTime
                resolution="day"
                datetime={revocationDeadline}
              />
            </>
          ) : null}
          .
        </Text>
        <Text>
          Benefits {benefitsRevoked ? 'were revoked' : 'will be revoked'}
          {benefitsRevocationDate ? (
            <>
              {' on '}
              <FormattedDateTime
                resolution="day"
                datetime={benefitsRevocationDate}
              />
            </>
          ) : null}
          .
        </Text>
      </Box>
    </Box>
  </Box>
)
