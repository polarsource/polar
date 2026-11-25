import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { format } from 'date-fns'

// The day, then the time of day in a quieter color, as the orders table has it.
export const BillingHistoryDate = ({
  at,
  muted = false,
}: {
  at: string | number
  // For what has not happened yet, and for rows under an order.
  muted?: boolean
}) => {
  const date = new Date(at)
  return (
    <Box alignItems="baseline" columnGap="s" minWidth={0}>
      <Text color={muted ? 'muted' : 'default'} tabularNums wrap="nowrap">
        {format(date, 'MMM d, yyyy')}
      </Text>
      <Text color="muted" tabularNums wrap="nowrap">
        {format(date, 'HH:mm')}
      </Text>
    </Box>
  )
}
