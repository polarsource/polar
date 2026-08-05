import { Status } from '@polar-sh/orbit'
import { ReviewRow } from './reviewRows'
import { reviewStatus } from './reviewStatus'

// The import outcome as the table cell and the detail modal both show it, so
// the two can't drift apart.
export function ReviewStatusIndicator({ row }: { row: ReviewRow }) {
  const { label, color } = reviewStatus(row)
  return <Status status={label} color={color} size="small" />
}
