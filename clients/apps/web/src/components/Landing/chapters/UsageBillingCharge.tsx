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
      rowGap="s"
      marginHorizontal="xl"
      paddingTop="l"
      paddingBottom="l"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box
        justifyContent="between"
        alignItems="center"
        columnGap="l"
        paddingBottom="s"
      >
        <Box alignItems="center" columnGap="s">
          <CreditCard size={14} />
          <Text variant="default">Visa •••• 4242</Text>
        </Box>
        <Text variant="default" color="muted">
          Charges Nov 1
        </Text>
      </Box>
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
          {dollars(total, 2)}
        </Text>
      </Box>
    </Box>
  )
}
