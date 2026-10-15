import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

type ChargeAmounts = {
  subtotal_amount: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  applied_balance_amount?: number
  due_amount?: number
}

const AmountRow = ({
  label,
  amount,
  muted = true,
}: {
  label: string
  amount: string
  muted?: boolean
}) => (
  <Box justifyContent="between" alignItems="center">
    <Text as="span" variant="body" color={muted ? 'muted' : 'default'}>
      {label}
    </Text>
    <Text
      as="span"
      variant="body"
      color={muted ? 'muted' : 'default'}
      tabularNums
    >
      {amount}
    </Text>
  </Box>
)

export const PreviewTotals = ({
  preview,
  currency,
  estimated,
  note,
}: {
  preview: ChargeAmounts | undefined
  currency: string
  estimated: boolean
  note?: string
}) => {
  const hasTaxes = preview != null && preview.tax_amount > 0
  const hasDiscount = preview != null && preview.discount_amount > 0
  const appliedBalance = preview?.applied_balance_amount
  const dueAmount = preview?.due_amount
  const showBalance =
    appliedBalance != null && appliedBalance !== 0 && dueAmount != null
  const format = formatCurrency('compact')

  return (
    <Box
      flexDirection="column"
      rowGap="xs"
      marginTop="s"
      paddingTop="s"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      {(hasTaxes || hasDiscount) && preview && (
        <AmountRow
          label="Subtotal"
          amount={format(preview.subtotal_amount, currency)}
        />
      )}

      {hasDiscount && preview && (
        <AmountRow
          label="Discount"
          amount={format(-1 * preview.discount_amount, currency)}
        />
      )}

      {hasTaxes && preview && (
        <AmountRow
          label="Taxes"
          amount={format(preview.tax_amount, currency)}
        />
      )}

      <Box justifyContent="between" alignItems="center">
        <Text as="span" variant="body">
          {estimated ? 'Estimated Total' : 'Total'}
        </Text>
        {preview ? (
          <Text as="span" variant="heading-xs" tabularNums>
            {format(preview.total_amount, currency)}
          </Text>
        ) : (
          <span className="animate-pulse">
            <Text as="span" variant="heading-xs" color="muted">
              Loading…
            </Text>
          </span>
        )}
      </Box>

      {showBalance && (
        <>
          <AmountRow
            label="Applied balance"
            amount={format(appliedBalance, currency)}
          />
          <AmountRow
            label="To be paid"
            amount={format(dueAmount, currency)}
            muted={false}
          />
        </>
      )}

      {note && (
        <Text variant="caption" color="muted">
          {note}
        </Text>
      )}
    </Box>
  )
}
