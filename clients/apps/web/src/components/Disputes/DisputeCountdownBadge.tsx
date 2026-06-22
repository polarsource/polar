'use client'

import {
  DisputeStatusDisplayColor,
  DisputeStatusDisplayTitle,
} from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/orbit'
import { differenceInCalendarDays } from 'date-fns'
import { useState } from 'react'

export const DisputeCountdownBadge = ({
  dispute,
}: {
  dispute: schemas['Dispute']
}) => {
  const [now] = useState(() => new Date())

  if (dispute.evidence_due_by) {
    if (dispute.past_due) {
      return <Status status="Overdue" color="red" size="small" />
    }
    const days = differenceInCalendarDays(
      new Date(dispute.evidence_due_by),
      now,
    )
    const label =
      days <= 0
        ? 'Due today'
        : days === 1
          ? '1 day to respond'
          : `${days} days to respond`
    return <Status status={label} color="yellow" size="small" />
  }

  return (
    <Status
      status={DisputeStatusDisplayTitle[dispute.status]}
      color={DisputeStatusDisplayColor[dispute.status]}
      size="small"
    />
  )
}
