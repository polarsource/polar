import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CompactColumn, CompactTable } from './CompactTable'
import {
  formatAmount,
  formatTokens,
  formatUnitAmount,
  perUse,
  totalTokens,
} from './featureEconomics'
import { FeatureSection } from './FeatureSection'

type Step = schemas['FeatureStep']

// Where one use's cost goes: the steps below the feature.
export const FeatureCost = ({
  steps,
  uses,
  currency,
  selected,
  onSelect,
}: {
  steps: Step[]
  uses: number
  currency: string
  selected: string | null
  onSelect: (name: string) => void
}) => {
  const total = steps.reduce((sum, step) => sum + Number(step.cost), 0)
  const columns: CompactColumn<Step>[] = [
    {
      id: 'step',
      title: 'Step',
      sort: (s) => s.label,
      cell: (s) => <Text truncate>{s.label}</Text>,
    },
    {
      id: 'share',
      title: 'Share',
      width: 136,
      wide: true,
      sort: (s) => Number(s.cost),
      cell: (s) => {
        const share = total > 0 ? Number(s.cost) / total : 0
        return (
          <Box alignItems="center" gap="s" width="100%">
            <Box flexGrow={1} height={4} backgroundColor="background-card">
              <Box
                height="100%"
                width={`${share * 100}%`}
                backgroundColor="background-inverse"
              />
            </Box>
            <Box width={36} justifyContent="end">
              <Text color="muted" tabularNums>
                {Math.round(share * 100)}%
              </Text>
            </Box>
          </Box>
        )
      },
    },
    {
      id: 'unit_cost',
      title: 'Per use',
      width: 104,
      align: 'end',
      sort: (s) => Number(s.cost),
      cell: (s) => (
        <Text tabularNums>
          {formatUnitAmount(perUse(Number(s.cost), uses), currency)}
        </Text>
      ),
    },
    {
      id: 'tokens',
      title: 'Tokens',
      width: 72,
      align: 'end',
      wide: true,
      sort: (s) => totalTokens(s),
      cell: (s) => (
        <Text color="muted" tabularNums>
          {totalTokens(s) > 0 ? formatTokens(totalTokens(s)) : ''}
        </Text>
      ),
    },
    {
      id: 'cost',
      title: 'Cost',
      width: 88,
      align: 'end',
      sort: (s) => Number(s.cost),
      cell: (s) => (
        <Text tabularNums>{formatAmount(Number(s.cost), currency)}</Text>
      ),
    },
  ]
  return (
    <FeatureSection title="Cost">
      <CompactTable
        columns={columns}
        rows={steps.filter((s) => Number(s.cost) > 0 || totalTokens(s) > 0)}
        rowKey={(s) => s.name}
        onRowClick={(s) => onSelect(s.name)}
        isActive={(s) => s.name === selected}
        defaultSort={{ id: 'cost', desc: true }}
      />
    </FeatureSection>
  )
}
