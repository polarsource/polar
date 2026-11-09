import { Text } from '@polar-sh/orbit'
import { CompactColumn, CompactTable } from './CompactTable'
import {
  economics,
  FeaturePlan,
  formatCount,
  formatMargin,
  marginColor,
  formatUnitAmount,
  perUse,
} from './featureEconomics'
import { FeatureSection } from './FeatureSection'
import { FREE_PLAN } from './useSelection'

// What one use costs and earns on each plan. Each row is where a plan's
// controls for the feature will live.
export const FeaturePlans = ({
  plans,
  currency,
  selected,
  onSelect,
}: {
  plans: FeaturePlan[]
  currency: string
  selected: string | null
  onSelect: (id: string) => void
}) => {
  const columns: CompactColumn<FeaturePlan>[] = [
    {
      id: 'plan',
      title: 'Plan',
      sort: (p) => p.name ?? '',
      cell: (p) => (
        <Text color={p.name ? undefined : 'muted'} truncate>
          {p.name ?? 'Free'}
        </Text>
      ),
    },
    {
      id: 'customers',
      title: 'Customers',
      width: 80,
      align: 'end',
      wide: true,
      sort: (p) => p.customers,
      cell: (p) => <Text tabularNums>{formatCount(p.customers)}</Text>,
    },
    {
      id: 'uses',
      title: 'Uses',
      width: 72,
      align: 'end',
      sort: (p) => p.occurrences,
      cell: (p) => <Text tabularNums>{formatCount(p.occurrences)}</Text>,
    },
    {
      id: 'unit_cost',
      title: 'Cost/use',
      width: 88,
      align: 'end',
      sort: (p) => perUse(Number(p.cost), p.occurrences),
      cell: (p) => (
        <Text tabularNums>
          {formatUnitAmount(perUse(Number(p.cost), p.occurrences), currency)}
        </Text>
      ),
    },
    {
      id: 'unit_revenue',
      title: 'Revenue/use',
      width: 96,
      align: 'end',
      wide: true,
      sort: (p) => perUse(Number(p.revenue), p.occurrences),
      cell: (p) => (
        <Text tabularNums>
          {formatUnitAmount(perUse(Number(p.revenue), p.occurrences), currency)}
        </Text>
      ),
    },
    {
      id: 'margin',
      title: 'Margin',
      width: 88,
      align: 'end',
      sort: (p) => economics(p).marginRate ?? -Infinity,
      cell: (p) => (
        <Text color={marginColor(economics(p))} tabularNums>
          {formatMargin(economics(p))}
        </Text>
      ),
    },
  ]
  return (
    <FeatureSection title="Plans">
      <CompactTable
        columns={columns}
        rows={plans}
        rowKey={(p) => p.name ?? FREE_PLAN}
        onRowClick={(p) => onSelect(p.name ?? FREE_PLAN)}
        isActive={(p) => (p.name ?? FREE_PLAN) === selected}
        defaultSort={{ id: 'uses', desc: true }}
      />
    </FeatureSection>
  )
}
