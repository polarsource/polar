import { Box } from '@/components/Shared/Box'
import { Text } from '@/components/Shared/Text'

interface TrialPeriodCardProps {
  interval: string
  intervalCount: number
}

export const TrialPeriodCard = ({
  interval,
  intervalCount,
}: TrialPeriodCardProps) => {
  return (
    <Box flexDirection="column" gap="spacing-8">
      <Text variant="bodyMedium" color="subtext">
        Trial Period
      </Text>
      <Box
        padding="spacing-16"
        backgroundColor="card"
        borderRadius="border-radius-12"
      >
        <Text variant="body">
          {intervalCount} {interval}
          {intervalCount > 1 ? 's' : ''}
        </Text>
      </Box>
    </Box>
  )
}
