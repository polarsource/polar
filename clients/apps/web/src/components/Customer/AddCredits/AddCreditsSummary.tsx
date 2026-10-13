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

const SummaryCard = ({ children }: { children: ReactNode }) => (
  <Box
    flexDirection="column"
    rowGap="s"
    padding="l"
    borderRadius="l"
    backgroundColor="background-card"
  >
    {children}
  </Box>
)

export const AddCreditsSummary = ({
  option,
  units,
}: {
  option?: MeterCreditOption
  units: number | null
}) => {
  const currentBalance = (
    <SummaryRow
      label="Current balance"
      value={option ? <FormattedUnits value={option.balance} /> : '—'}
    />
  )

  if (!option || !units) {
    return <SummaryCard>{currentBalance}</SummaryCard>
  }

  const { balanceAfter, overage } = getCreditPreview(option, units)

  return (
    <SummaryCard>
      {currentBalance}
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
          value={<FormattedUnits value={balanceAfter} />}
        />
        {overage && (
          <SummaryRow
            strong
            label="Overage this period"
            value={`${formatCurrency('compact')(overage.before, overage.currency)} → ${formatCurrency('compact')(overage.after, overage.currency)}`}
          />
        )}
      </Box>
    </SummaryCard>
  )
}
