import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const UNDERLINE_CLASS =
  'dark:decoration-polar-500 underline decoration-gray-400 decoration-dashed decoration-1 underline-offset-4'

const format = formatCurrency('accounting')

// An amount in the account's currency. When the customer paid in another one,
// it opens to what they paid and the rate it was converted at.
export const IncomeAmount = ({
  amount,
  currency,
  presentmentAmount,
  payment,
}: {
  amount: number
  currency: string
  presentmentAmount: number
  payment: schemas['TransactionEmbedded']
}) => {
  const presentmentCurrency = payment.presentment_currency ?? payment.currency
  const value = (
    <Text as="span" tabularNums wrap="nowrap">
      {format(amount, currency)}
    </Text>
  )
  if (amount === 0 || presentmentCurrency === currency) {
    return value
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={UNDERLINE_CLASS}>{value}</span>
      </TooltipTrigger>
      <TooltipContent>
        <Box flexDirection="column" gap="xs">
          <Box justifyContent="between" gap="xl">
            <Text color="muted">Paid</Text>
            <Text tabularNums>
              {format(presentmentAmount, presentmentCurrency)}
            </Text>
          </Box>
          <Box justifyContent="between" gap="xl">
            <Text color="muted">
              {presentmentCurrency.toUpperCase()} → {currency.toUpperCase()}
            </Text>
            <Text tabularNums>{payment.exchange_rate}</Text>
          </Box>
        </Box>
      </TooltipContent>
    </Tooltip>
  )
}
