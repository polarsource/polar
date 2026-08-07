import { CountEntity } from '@/hooks/queries/merchantMigrationCounts'
import { SegmentedControl } from '@polar-sh/orbit'
import { entityLabelPlural, ReviewScope } from './reviewRows'

const numberFormat = new Intl.NumberFormat('en-US')
const SCOPES: ReviewScope[] = ['all', 'products', 'customers', 'subscriptions']

interface Props {
  value: ReviewScope
  counts: Record<CountEntity, number>
  onChange: (scope: ReviewScope) => void
}

export function ReviewEntityTabs({ value, counts, onChange }: Props) {
  const total = counts.products + counts.customers + counts.subscriptions
  const countFor = (scope: ReviewScope) =>
    scope === 'all' ? total : counts[scope]

  return (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as ReviewScope)}
      options={SCOPES.map((scope) => ({
        value: scope,
        label: `${entityLabelPlural(scope)} ${numberFormat.format(countFor(scope))}`,
      }))}
    />
  )
}
