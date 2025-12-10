import { Box } from '@/components/Shared/Box'
import { Text } from './Text'

export interface EmptyStateProps {
  title: string
  description: string
}

export const EmptyState = ({ title, description }: EmptyStateProps) => {
  return (
    <Box
      flex={1}
      justifyContent="center"
      alignItems="center"
      paddingHorizontal="spacing-16"
      paddingVertical="spacing-48"
      borderWidth={1}
      borderColor="border"
      gap="spacing-8"
      borderRadius="border-radius-24"
    >
      <Text textAlign="center">{title}</Text>
      <Text color="subtext" textAlign="center">
        {description}
      </Text>
    </Box>
  )
}
