import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Circle } from 'lucide-react'
import { ReviewRow } from './reviewRows'
import { reviewStatus } from './reviewStatus'

// The dot-and-label pair the table cell and the detail modal both show, so the
// two can't drift apart.
export function ReviewStatusIndicator({ row }: { row: ReviewRow }) {
  const { label, dot, labelColor } = reviewStatus(row)
  return (
    <Box alignItems="center" columnGap="s" minWidth={0}>
      <Box color={dot} flexShrink={0} alignItems="center">
        <Circle size={8} fill="currentColor" strokeWidth={0} />
      </Box>
      <Text truncate color={labelColor}>
        {label}
      </Text>
    </Box>
  )
}
