import { Box } from '@/components/Shared/Box'
import { ThemedText } from './ThemedText'

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
      borderRadius="border-radius-16"
    >
      <ThemedText style={{ fontSize: 16, textAlign: 'center' }}>
        {title}
      </ThemedText>
      <ThemedText style={{ fontSize: 16, textAlign: 'center' }} secondary>
        {description}
      </ThemedText>
    </Box>
  )
}
