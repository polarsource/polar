import { SegmentedControl } from '@polar-sh/orbit'

export type ReviewFilter =
  | 'all'
  | 'to_prepare'
  | 'ready'
  | 'attention'
  | 'skipped'

export type ReviewFilterCounts = Record<ReviewFilter, number>

const numberFormat = new Intl.NumberFormat('en-US')

const OPTIONS: { value: ReviewFilter; label: string }[] = [
  { value: 'all', label: 'All rows' },
  { value: 'to_prepare', label: 'To prepare' },
  { value: 'ready', label: 'Ready to switch' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'skipped', label: "Won't import" },
]

export const EMPTY_MESSAGES: Record<ReviewFilter, string> = {
  all: 'No subscriptions to show.',
  to_prepare: 'No subscriptions need preparation.',
  ready: 'No subscriptions are ready to switch.',
  attention: 'Nothing needs attention.',
  skipped: 'Nothing is staying on Stripe.',
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
