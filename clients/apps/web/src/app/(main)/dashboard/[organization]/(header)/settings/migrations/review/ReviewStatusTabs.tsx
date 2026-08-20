import { SegmentedControl } from '@polar-sh/orbit'

export type ReviewFilter = 'attention' | 'skipped' | 'all'

export type ReviewFilterCounts = Record<ReviewFilter, number>

const numberFormat = new Intl.NumberFormat('en-US')

const OPTIONS: { value: ReviewFilter; label: string }[] = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'skipped', label: "Won't import" },
  { value: 'all', label: 'All rows' },
]

export const EMPTY_MESSAGES: Record<ReviewFilter, string> = {
  attention: 'Nothing needs attention.',
  skipped: 'Nothing is staying on Stripe.',
  all: 'No records to show.',
}

interface Props {
  value: ReviewFilter
  counts: ReviewFilterCounts
  onChange: (filter: ReviewFilter) => void
}

export function ReviewStatusTabs({ value, counts, onChange }: Props) {
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as ReviewFilter)}
      options={OPTIONS.map((option) => ({
        ...option,
        label: `${option.label} ${numberFormat.format(counts[option.value])}`,
      }))}
    />
  )
}
