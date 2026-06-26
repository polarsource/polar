import {
  DisputeStatusDisplayTitle,
  type DisputeStatusFilter,
} from '@/utils/dispute'
import { schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import React from 'react'

const STATUSES: schemas['DisputeStatus'][] = [
  'needs_response',
  'accepted',
  'under_review',
  'won',
  'lost',
  'prevented',
  'early_warning',
]

interface Props {
  value: DisputeStatusFilter
  onChange: (value: DisputeStatusFilter) => void
}

export const DisputeStatusSelect: React.FC<Props> = ({ value, onChange }) => (
  <Select
    value={value}
    onValueChange={(value) => onChange(value as DisputeStatusFilter)}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select a status" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="any">
        <span className="whitespace-nowrap">Any status</span>
      </SelectItem>
      <SelectSeparator />
      {STATUSES.map((status) => (
        <SelectItem key={status} value={status}>
          {DisputeStatusDisplayTitle[status]}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)
