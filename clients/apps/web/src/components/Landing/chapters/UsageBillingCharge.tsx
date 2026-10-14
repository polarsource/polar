'use client'

import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CreditCard } from 'lucide-react'
import { dollars, PLAN_PRICE } from './useUsageConversation'

/** A value on the bill. Remounted when usage settles, so it dips and recovers and the bill is seen to react. */
const Amount = ({
  value,
  settled,
  emphasis = false,
}: {
  value: number
  settled: number
  emphasis?: boolean
}) => (
  <Box alignItems="baseline" columnGap="s">
    <div key={settled} className="[animation:settle_600ms_ease-out_both]">
      <Text
        variant={emphasis ? 'heading-xxs' : 'default'}
        color={emphasis ? 'default' : 'muted'}
        tabularNums
      >
        {dollars(value, 2)}
      </Text>
    </div>
  </Box>
)

export const UsageBillingCharge = ({
  inputCharge,
  outputCharge,
  billed,
}: {
  inputCharge: number
  outputCharge: number
  billed: number
}) => (
  <div className="dark:bg-polar-900 w-full rounded-[20px] bg-white">
    <Box width="100%" flexDirection="column" rowGap="s" padding="xl">
      <Box
        justifyContent="between"
        alignItems="center"
        columnGap="l"
        paddingBottom="m"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box alignItems="center" columnGap="s">
          <CreditCard size={14} />
          <Text variant="default">Visa •••• 4242</Text>
        </Box>
        <Text variant="default" color="muted">
          Charges Nov 1
        </Text>
      </Box>
      <Box justifyContent="between" columnGap="l">
        <Text variant="default" color="muted">
          Pro
        </Text>
        <Text variant="default" color="muted" tabularNums>
          {dollars(PLAN_PRICE, 2)}
        </Text>
      </Box>
      <Box justifyContent="between" columnGap="l">
        <Text variant="default" color="muted">
          Input tokens
        </Text>
        <Amount value={inputCharge} settled={billed} />
      </Box>
      <Box justifyContent="between" columnGap="l">
        <Text variant="default" color="muted">
          Output tokens
        </Text>
        <Amount value={outputCharge} settled={billed} />
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
        <Amount
          value={PLAN_PRICE + inputCharge + outputCharge}
          settled={billed}
          emphasis
        />
      </Box>
    </Box>
  </div>
)
