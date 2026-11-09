import { Text } from '@polar-sh/orbit'
import { CompactColumn, CompactTable } from './CompactTable'
import {
  economics,
  FeatureSummary,
  formatAmount,
  formatCount,
  formatMargin,
  marginColor,
  formatUnitAmount,
  perUse,
} from './featureEconomics'

export const FeatureList = ({
  features,
  currency,
  featureHref,
  hovered,
  onHover,
}: {
  features: FeatureSummary[]
  currency: string
  featureHref: (name: string) => string
  hovered: string | null
  onHover: (name: string | null) => void
}) => {
  const columns: CompactColumn<FeatureSummary>[] = [
    {
      id: 'feature',
      title: 'Feature',
      grow: 2,
      minWidth: 140,
      sort: (f) => f.label,
      cell: (f) => <Text truncate>{f.label}</Text>,
    },
    {
      id: 'uses',
      title: 'Uses',
      width: 72,
      align: 'end',
      sort: (f) => f.occurrences,
      cell: (f) => <Text tabularNums>{formatCount(f.occurrences)}</Text>,
    },
    {
      id: 'unit_cost',
      title: 'Cost/use',
      width: 88,
      align: 'end',
      wide: true,
      sort: (f) => perUse(Number(f.cost), f.occurrences),
      cell: (f) => (
        <Text color="muted" tabularNums>
          {formatUnitAmount(perUse(Number(f.cost), f.occurrences), currency)}
        </Text>
      ),
    },
    {
      id: 'cost',
      title: 'Cost',
      width: 88,
      align: 'end',
      sort: (f) => Number(f.cost),
      cell: (f) => (
        <Text tabularNums>{formatAmount(Number(f.cost), currency)}</Text>
      ),
    },
    {
      id: 'revenue',
      title: 'Revenue',
      width: 88,
      align: 'end',
      wide: true,
      sort: (f) => Number(f.revenue),
      cell: (f) => (
        <Text tabularNums>{formatAmount(Number(f.revenue), currency)}</Text>
      ),
    },
    {
      id: 'margin',
      title: 'Margin',
      width: 88,
      align: 'end',
      sort: (f) => economics(f).marginRate ?? -Infinity,
      cell: (f) => (
        <Text color={marginColor(economics(f))} tabularNums>
          {formatMargin(economics(f))}
        </Text>
      ),
    },
  ]
  return (
    <CompactTable
      columns={columns}
      rows={features}
      rowKey={(f) => f.name}
      rowHref={(f) => featureHref(f.name)}
      isActive={(f) => f.name === hovered}
      onRowHover={(f) => onHover(f?.name ?? null)}
      defaultSort={{ id: 'cost', desc: true }}
    />
  )
}
