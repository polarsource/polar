import { Status } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Info } from 'lucide-react'
import { PaymentMethodTooltip } from './PaymentMethodLabel'
import { ReviewRow } from './reviewRows'
import { reviewStatus } from './reviewStatus'

// The import outcome as the table cell and the detail modal both show it, so
// the two can't drift apart.
export function ReviewStatusIndicator({ row }: { row: ReviewRow }) {
  const { label, color, paymentMethod } = reviewStatus(row)
  const chip = <Status status={label} color={color} size="small" />
  if (!paymentMethod?.note) return chip
  return (
    <PaymentMethodTooltip note={paymentMethod.note}>
      <Box
        display="inline-flex"
        alignItems="center"
        columnGap="xs"
        cursor="default"
        color="text-tertiary"
        aria-label={`${label}: ${paymentMethod.note.title}`}
      >
        {chip}
        <Info className="size-3" />
      </Box>
    </PaymentMethodTooltip>
  )
}
