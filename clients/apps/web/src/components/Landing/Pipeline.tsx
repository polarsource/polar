'use client'

import { useInView } from '@/hooks/useInView'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, Circle, LoaderCircle } from '@polar-sh/orbit/icons'
import { useEffect, useState } from 'react'
import { Shimmer } from './Shimmer'
import { Sheet, Window } from './story/Frame'

interface Market {
  city: string
  country: string
  plan: string
  taxLabel: string
  tax: string
  total: string
  payout: string
}

/** One order per loop, each in a different market, all settling to the same bank account in dollars. */
const MARKETS: Market[] = [
  {
    city: 'Berlin',
    country: 'Germany',
    plan: '€2,299.00',
    taxLabel: 'VAT 19%',
    tax: '€436.81',
    total: '€2,735.81',
    payout: '$2,412.60',
  },
  {
    city: 'London',
    country: 'the UK',
    plan: '£1,999.00',
    taxLabel: 'VAT 20%',
    tax: '£399.80',
    total: '£2,398.80',
    payout: '$2,447.15',
  },
  {
    city: 'Austin',
    country: 'Texas',
    plan: '$2,499.00',
    taxLabel: 'Sales tax 6.25%',
    tax: '$156.19',
    total: '$2,655.19',
    payout: '$2,374.05',
  },
  {
    city: 'Tokyo',
    country: 'Japan',
    plan: '¥379,000',
    taxLabel: 'JCT 10%',
    tax: '¥37,900',
    total: '¥416,900',
    payout: '$2,396.80',
  },
]

const steps = (m: Market) => [
  { id: 'capture', label: 'Payment captured' },
  { id: 'screen', label: 'Screened for fraud' },
  { id: 'calculate', label: `${m.taxLabel} calculated` },
  { id: 'remit', label: `Tax remitted in ${m.country}` },
  { id: 'payout', label: 'Paid out to SEB •••• 9128' },
]

const STEP_MS = 850
const HOLD_MS = 2600

/** Advances through the steps of one order, holds on the settled state, then moves to the next market. */
const useOrder = () => {
  const { ref, inView } = useInView()
  const [market, setMarket] = useState(0)
  const [step, setStep] = useState(0)
  const count = steps(MARKETS[0]).length

  useEffect(() => {
    if (!inView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const still = window.setTimeout(() => setStep(count), 0)
      return () => clearTimeout(still)
    }
    const timer = window.setTimeout(
      () => {
        if (step < count) {
          setStep((s) => s + 1)
        } else {
          setStep(0)
          setMarket((m) => (m + 1) % MARKETS.length)
        }
      },
      step < count ? STEP_MS : HOLD_MS,
    )
    return () => clearTimeout(timer)
  }, [inView, step, count])

  return { ref, market: MARKETS[market], marketIndex: market, step }
}

const StepIcon = ({ state }: { state: 'done' | 'active' | 'pending' }) => (
  <Box
    width={14}
    height={14}
    alignItems="center"
    justifyContent="center"
    flexShrink={0}
  >
    {state === 'done' ? (
      <Check size={12} />
    ) : state === 'active' ? (
      <LoaderCircle size={12} className="animate-spin" />
    ) : (
      <Circle size={4} fill="currentColor" />
    )}
  </Box>
)

const Line = ({ label, value }: { label: string; value: string }) => (
  <Box justifyContent="between" columnGap="l">
    <Text variant="default" color="muted">
      {label}
    </Text>
    <Text variant="default" color="muted" tabularNums>
      {value}
    </Text>
  </Box>
)

/** An order placed in a local currency, handled by Polar step by step until the payout lands. */
export const Pipeline = () => {
  const { ref, market, marketIndex, step } = useOrder()
  const list = steps(market)
  const settled = step >= list.length

  return (
    <Window flow={2} narrow innerRef={ref} aside="Merchant of record">
      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap="xs">
        <Sheet
          title="Order"
          aside={
            <Text variant="caption" color="muted">
              Acme Inc in {market.city}
            </Text>
          }
        >
          <div
            key={marketIndex}
            className="flex flex-1 [animation:appear_360ms_cubic-bezier(0.2,0.8,0.2,1)_both] flex-col gap-6"
          >
            <Text variant="heading-xs" tabularNums>
              {market.total}
            </Text>
            <Box flexDirection="column" rowGap="s">
              <Line label="Business plan" value={market.plan} />
              <Line label={market.taxLabel} value={market.tax} />
            </Box>
          </div>
          <Box
            justifyContent="between"
            alignItems="baseline"
            paddingTop="m"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Text variant="default" color="muted">
              Your payout
            </Text>
            <Text
              variant="heading-xxs"
              color={settled ? 'default' : 'muted'}
              tabularNums
            >
              {market.payout}
            </Text>
          </Box>
        </Sheet>
        <Sheet
          title="Polar"
          aside={
            <Text variant="caption" color="muted">
              100+ markets
            </Text>
          }
        >
          <Box flexDirection="column" rowGap="m">
            {list.map(({ id, label }, i) => {
              const state =
                i < step ? 'done' : i === step ? 'active' : 'pending'
              return (
                <Box
                  key={id}
                  alignItems="center"
                  columnGap="s"
                  color={
                    state === 'done'
                      ? 'text-primary'
                      : state === 'active'
                        ? 'text-secondary'
                        : 'text-tertiary'
                  }
                  transitionProperty="colors"
                  transitionDuration="base"
                >
                  <StepIcon state={state} />
                  <Text variant="default" color="inherit">
                    {state === 'active' ? (
                      <Shimmer active>{label}</Shimmer>
                    ) : (
                      label
                    )}
                  </Text>
                </Box>
              )
            })}
          </Box>
          <Box marginTop="auto" paddingTop="l">
            <Text variant="caption" color="muted">
              We take on tax, fraud, refunds and chargebacks
            </Text>
          </Box>
        </Sheet>
      </Grid>
    </Window>
  )
}
