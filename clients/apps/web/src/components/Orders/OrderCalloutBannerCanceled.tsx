import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'

interface OrderCalloutBannerCanceledProps {
  finalAttemptAt: string | null
  declineMessage: string | null | undefined
  endedAt: string | null
  benefitsRevocationDate: Date | null
  benefitsRevoked: boolean
}

export const OrderCalloutBannerCanceled = ({
  finalAttemptAt,
  declineMessage,
  endedAt,
  benefitsRevocationDate,
  benefitsRevoked,
}: OrderCalloutBannerCanceledProps) => (
  <Box flexDirection="column" rowGap="l">
    <Text variant="heading-xxs">Payment couldn&apos;t be recovered</Text>

    <Box
      display="grid"
      gridTemplateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
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
          <Text color="muted">Final attempt</Text>
          {finalAttemptAt ? (
            <Text variant="body">
              <FormattedDateTime resolution="time" datetime={finalAttemptAt} />
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
          <Text color="muted">Subscription canceled</Text>
          {endedAt ? (
            <Text variant="body">
              <FormattedDateTime resolution="day" datetime={endedAt} />
            </Text>
          ) : null}
        </Box>
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
