import { SegmentedControl } from '@polar-sh/orbit'
import { SWITCH_FILTERS, SwitchFilter } from './switchCopy'

const numberFormat = new Intl.NumberFormat('en-US')

interface Props {
  value: SwitchFilter
  counts: Record<SwitchFilter, number>
  onChange: (filter: SwitchFilter) => void
}

export function SwitchStatusTabs({ value, counts, onChange }: Props) {
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as SwitchFilter)}
      options={SWITCH_FILTERS.map((option) => ({
        ...option,
        label: `${option.label} ${numberFormat.format(counts[option.value])}`,
      }))}
    />
  )
}
