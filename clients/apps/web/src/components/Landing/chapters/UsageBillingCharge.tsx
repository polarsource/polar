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
      {value === 0 && !emphasis ? (
        <Box
          width={56}
          height={10}
          backgroundColor="background-card"
          borderRadius="s"
        />
      ) : (
        <Text
          variant={emphasis ? 'heading-xxs' : 'default'}
          color={emphasis ? 'default' : 'muted'}
          tabularNums
        >
          {dollars(value, emphasis ? 2 : 4)}
        </Text>
      )}
    </div>
  </Box>
)

const Bone = ({ w, h = 10 }: { w: number; h?: number }) => (
  <Box
    width={w}
    height={h}
    backgroundColor="background-card"
    borderRadius="s"
  />
)

export const UsageBillingCharge = ({
  setupLevel,
  inputCharge,
  outputCharge,
  billed,
}: {
  /** 1 once the product exists, 3 once the customer has subscribed. */
  setupLevel: number
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
        {setupLevel >= 3 ? (
          <>
            <Box alignItems="center" columnGap="s">
              <CreditCard size={14} />
              <Text variant="default">Visa •••• 4242</Text>
            </Box>
            <Text variant="default" color="muted">
              Charges Nov 1
            </Text>
          </>
        ) : (
          <>
            <Bone w={104} />
            <Bone w={80} />
          </>
        )}
      </Box>
      <Box justifyContent="between" columnGap="l">
        <Text variant="default" color="muted">
          Pro
        </Text>
        {setupLevel >= 1 ? (
          <Text variant="default" color="muted" tabularNums>
            {dollars(PLAN_PRICE, 2)}
          </Text>
        ) : (
          <Bone w={56} />
        )}
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
        {setupLevel >= 1 ? (
          <Amount
            value={PLAN_PRICE + inputCharge + outputCharge}
            settled={billed}
            emphasis
          />
        ) : (
          <Bone w={72} h={14} />
        )}
      </Box>
    </Box>
  </div>
)
