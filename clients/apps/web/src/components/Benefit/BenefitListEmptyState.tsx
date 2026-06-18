import { Box } from '@polar-sh/orbit/Box'
import { Button, Text } from '@polar-sh/orbit'

export const BenefitListEmptyState = ({
  hasFilters,
  onCreate,
  onClearFilters,
}: {
  hasFilters: boolean
  onCreate: () => void
  onClearFilters: () => void
}) => {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap="m"
      paddingVertical="2xl"
      paddingHorizontal="xl"
      textAlign="center"
    >
      <Box flexDirection="column" gap="xs">
        <Text variant="default">
          {hasFilters ? 'No benefits found' : 'No benefits yet'}
        </Text>
        <Text variant="caption" color="muted">
          {hasFilters
            ? 'No benefits match your search or filter.'
            : 'Create your first benefit to get started.'}
        </Text>
      </Box>
      {hasFilters ? (
        <Button variant="secondary" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      ) : (
        <Button size="sm" onClick={onCreate}>
          Create Benefit
        </Button>
      )}
    </Box>
  )
}
