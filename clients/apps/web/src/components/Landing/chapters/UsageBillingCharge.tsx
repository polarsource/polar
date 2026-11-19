'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CreditCard } from '@polar-sh/orbit/icons'
import { useTweened } from './useTweened'
import { dollars, PLAN_PRICE } from './useUsageStream'

export const UsageBillingCharge = ({
  usageCharge,
}: {
  usageCharge: number
}) => {
  const total = useTweened(PLAN_PRICE + usageCharge)
  return (
    <Box
      flexDirection="column"
      rowGap="xs"
      marginHorizontal="xl"
      paddingVertical="l"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box justifyContent="between" alignItems="baseline" columnGap="l">
        <Text variant="body">Next charge</Text>
        <Text variant="heading-xxs" as="p" tabularNums>
          {dollars(total, 2)}
        </Text>
      </Box>
      <Box alignItems="center" columnGap="s" color="text-secondary">
        <CreditCard size={14} />
        <Text variant="caption" color="muted">
          Visa •••• 4242 · Nov 1
        </Text>
      </Box>
    </Box>
  )
}
