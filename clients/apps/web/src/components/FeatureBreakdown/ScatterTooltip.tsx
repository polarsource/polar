import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  economics,
  formatAmount,
  formatMargin,
  formatMarginRate,
} from './featureEconomics'

const TooltipRow = ({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) => (
  <Box justifyContent="between" gap="xl">
    <Text variant="caption" color="muted">
      {label}
    </Text>
    <Text variant="caption" color={danger ? 'danger' : undefined} tabularNums>
      {value}
    </Text>
  </Box>
)

export const PointTooltip = ({
  label,
  cost,
  revenue,
  currency,
}: {
  label: string
  cost: number
  revenue: number
  currency: string
}) => {
  const { margin, marginRate } = economics({ cost, revenue })
  return (
    <Box flexDirection="column" gap="xs" minWidth={180}>
      <Box paddingBottom="xs">
        <Text variant="caption" truncate>
          {label}
        </Text>
      </Box>
      <TooltipRow label="Revenue" value={formatAmount(revenue, currency)} />
      <TooltipRow label="Cost" value={formatAmount(cost, currency)} />
      <TooltipRow
        label="Margin"
        value={
          marginRate === null
            ? formatMargin({ cost, revenue, margin, marginRate })
            : `${formatAmount(margin, currency)} · ${formatMarginRate(marginRate)}`
        }
        danger={margin < 0}
      />
    </Box>
  )
}
