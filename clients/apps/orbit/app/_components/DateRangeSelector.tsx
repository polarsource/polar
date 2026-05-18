import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronDown } from 'lucide-react'

export const DateRangeSelector = () => {
  return (
    <Box
      display="flex"
      alignItems="center"
      columnGap="s"
      cursor="pointer"
      role="button"
      aria-label="Date range"
    >
      <Text variant="body" color="default">
        Last 30 days
      </Text>
      <ChevronDown size={20} strokeWidth={1.75} />
    </Box>
  )
}
