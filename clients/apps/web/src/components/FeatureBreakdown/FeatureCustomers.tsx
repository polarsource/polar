import { Text } from '@polar-sh/orbit'
import { CompactColumn, CompactTable } from './CompactTable'
import {
  customerKey,
  economics,
  FeatureDetailCustomer,
  formatAmount,
  formatCount,
  formatMargin,
  marginColor,
  formatTokens,
  totalTokens,
} from './featureEconomics'

type Row = FeatureDetailCustomer

const name = (c: Row) =>
  c.name ?? c.email ?? c.external_customer_id ?? 'Unknown'

export const FeatureCustomers = ({
  customers,
  currency,
  hovered,
  onHover,
  selected,
  onSelect,
}: {
  customers: Row[]
  currency: string
  hovered: string | null
  onHover: (key: string | null) => void
  selected: string | null
  onSelect: (key: string) => void
}) => {
  const columns: CompactColumn<Row>[] = [
    {
      id: 'customer',
      title: 'Customer',
      grow: 2,
      sort: name,
      cell: (c) => <Text truncate>{name(c)}</Text>,
    },
    {
      id: 'plan',
      title: 'Plan',
      wide: true,
      sort: (c) => c.plan ?? '',
      cell: (c) => (
        <Text color="muted" truncate>
          {c.plan ?? 'Free'}
        </Text>
      ),
    },
    {
      id: 'uses',
      title: 'Uses',
      width: 64,
      align: 'end',
      sort: (c) => c.occurrences,
      cell: (c) => <Text tabularNums>{formatCount(c.occurrences)}</Text>,
    },
    {
      id: 'tokens',
      title: 'Tokens',
      width: 64,
      align: 'end',
      wide: true,
      sort: (c) => totalTokens(c),
      cell: (c) => (
        <Text color="muted" tabularNums>
          {totalTokens(c) > 0 ? formatTokens(totalTokens(c)) : ''}
        </Text>
      ),
    },
    {
      id: 'cost',
      title: 'Cost',
      width: 88,
      align: 'end',
      sort: (c) => Number(c.cost),
      cell: (c) => (
        <Text tabularNums>{formatAmount(Number(c.cost), currency)}</Text>
      ),
    },
    {
      id: 'revenue',
      title: 'Revenue',
      width: 80,
      align: 'end',
      wide: true,
      sort: (c) => Number(c.revenue),
      cell: (c) => (
        <Text tabularNums>{formatAmount(Number(c.revenue), currency)}</Text>
      ),
    },
    {
      id: 'margin',
      title: 'Margin',
      width: 88,
      align: 'end',
      sort: (c) => economics(c).marginRate ?? -Infinity,
      cell: (c) => (
        <Text color={marginColor(economics(c))} tabularNums>
          {formatMargin(economics(c))}
        </Text>
      ),
    },
  ]
  return (
    <CompactTable
      columns={columns}
      rows={customers}
      rowKey={customerKey}
      isActive={(c) => [hovered, selected].includes(customerKey(c))}
      onRowHover={(c) => onHover(c ? customerKey(c) : null)}
      onRowClick={(c) => onSelect(customerKey(c))}
      defaultSort={{ id: 'cost', desc: true }}
    />
  )
}
