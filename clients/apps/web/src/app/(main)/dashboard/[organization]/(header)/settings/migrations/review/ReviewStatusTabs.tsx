import { SegmentedControl } from '@polar-sh/orbit'

export type ReviewFilter = 'attention' | 'skipped' | 'all'

const OPTIONS: { value: ReviewFilter; label: string }[] = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'skipped', label: "Won't import" },
  { value: 'all', label: 'All rows' },
]

export const EMPTY_MESSAGES: Record<ReviewFilter, string> = {
  attention: 'Nothing needs attention. Everything here is ready to import.',
  skipped: 'Nothing is staying on Stripe.',
  all: 'No records to show.',
}

interface Props {
  value: ReviewFilter
  onChange: (filter: ReviewFilter) => void
}

export function ReviewStatusTabs({ value, onChange }: Props) {
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as ReviewFilter)}
      options={OPTIONS}
    />
  )
}
