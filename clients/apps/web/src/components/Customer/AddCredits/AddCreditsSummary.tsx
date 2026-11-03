import FormattedUnits from '@/components/Meter/FormattedUnits'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { formatCurrency } from '@polar-sh/currency'
import { ReactNode } from 'react'
import { getCreditPreview, MeterCreditOption } from './creditPreview'

const SummaryRow = ({
  label,
  value,
  strong,
}: {
  label: string
  value: ReactNode
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
  option?: MeterCreditOption
  units: number
}) => {
  const preview = option ? getCreditPreview(option, units) : null
  const balanceValue = (value: number) =>
    option ? <FormattedUnits value={value} /> : '—'

  return (
    <Box
      flexDirection="column"
      rowGap="s"
      padding="l"
      borderRadius="l"
      backgroundColor="background-card"
    >
      <SummaryRow
        label="Current balance"
        value={balanceValue(option?.balance ?? 0)}
      />
      <SummaryRow
        label="Credits added"
        value={
          <>
            +<FormattedUnits value={units} />
          </>
        }
      />
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
          value={balanceValue(preview?.balanceAfter ?? 0)}
        />
        {preview?.overage && (
          <SummaryRow
            strong
            label="Overage this period"
            value={`${formatCurrency('compact')(preview.overage.before, preview.overage.currency)} → ${formatCurrency('compact')(preview.overage.after, preview.overage.currency)}`}
          />
        )}
      </Box>
    </Box>
  )
}
