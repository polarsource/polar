import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { formatCurrency } from '@polar-sh/currency'
import { getCreditPreview, MeterCreditOption } from './creditPreview'

const formatUnits = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(value)

const SummaryRow = ({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) => (
  <Box justifyContent="between" alignItems="center" columnGap="l">
    <Text color={strong ? 'default' : 'muted'}>{label}</Text>
    <Text color={strong ? 'default' : 'muted'}>{value}</Text>
  </Box>
)

export const AddCreditsSummary = ({
  option,
  units,
}: {
  option: MeterCreditOption
  units: number
}) => {
  const preview = getCreditPreview(option, units)
  const formatMoney = (amount: number, currency: string) =>
    formatCurrency('compact')(amount, currency)

  return (
    <Box
      flexDirection="column"
      rowGap="s"
      padding="l"
      borderRadius="l"
      backgroundColor="background-card"
    >
      <SummaryRow label="Current balance" value={formatUnits(option.balance)} />
      <SummaryRow label="Credits added" value={`+${formatUnits(units)}`} />
      <Box
        flexDirection="column"
        rowGap="s"
        paddingTop="s"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <SummaryRow
          strong
          label="New balance"
          value={formatUnits(preview.balanceAfter)}
        />
        {preview.overage && (
          <SummaryRow
            strong
            label="Overage this period"
            value={`${formatMoney(preview.overage.before, preview.overage.currency)} → ${formatMoney(preview.overage.after, preview.overage.currency)}`}
          />
        )}
      </Box>
    </Box>
  )
}
