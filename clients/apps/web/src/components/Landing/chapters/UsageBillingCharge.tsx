import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CreditCard } from 'lucide-react'
import { dollars, PLAN_PRICE } from './useUsageConversation'

const TAX_RATE = 0.2

const LineItem = ({ label, amount }: { label: string; amount: number }) => (
  <Box justifyContent="between" columnGap="l">
    <Text variant="caption" color="muted">
      {label}
    </Text>
    <Text variant="caption" color="muted" tabularNums>
      {dollars(amount, 2)}
    </Text>
  </Box>
)

export const UsageBillingCharge = ({
  usageCharge,
}: {
  usageCharge: number
}) => {
  const subtotal = PLAN_PRICE + usageCharge

  return (
    <Box
      width="100%"
      flexDirection="column"
      rowGap="m"
      padding="l"
      backgroundColor="background-card"
    >
      <Box justifyContent="between" alignItems="center" columnGap="l">
        <Box alignItems="center" columnGap="s">
          <CreditCard size={14} />
          <Text variant="caption">Visa •••• 4242</Text>
        </Box>
        <Text variant="caption" color="muted">
          Charges Nov 1
        </Text>
      </Box>
      <LineItem label="Lumen Pro" amount={PLAN_PRICE} />
      <LineItem label="AI tokens" amount={usageCharge} />
      <LineItem label="VAT 20%" amount={subtotal * TAX_RATE} />
      <Box
        justifyContent="between"
        alignItems="baseline"
        paddingTop="m"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Text variant="body">Card charge</Text>
        <Text variant="heading-xxs" tabularNums>
          {dollars(subtotal * (1 + TAX_RATE), 2)}
        </Text>
      </Box>
    </Box>
  )
}
