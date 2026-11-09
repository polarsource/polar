'use client'

import LogoIcon from '@/components/Brand/logos/LogoIcon'
import { useInView } from '@/hooks/useInView'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, LoaderCircle } from '@polar-sh/orbit/icons'
import { useReducedMotion } from 'motion/react'
import { Shimmer } from '../Shimmer'
import { ReactNode, useEffect, useState, useSyncExternalStore } from 'react'

const subscribeNoop = () => () => {}

const useSteps = (durations: number[], restingStep: number) => {
  const { ref, inView } = useInView()
  const [step, setStep] = useState(0)
  const reducedMotion = useReducedMotion()
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  )

  useEffect(() => {
    if (!inView || reducedMotion) return
    const timer = setTimeout(
      () => setStep((current) => (current + 1) % durations.length),
      durations[step],
    )
    return () => clearTimeout(timer)
  }, [inView, reducedMotion, step, durations])

  return { ref, step: mounted && reducedMotion ? restingStep : step }
}

/** The hero's chrome: a dark frame with a hairline and a 4px inset, a header on the frame, a lighter sheet inside. */
const Card = ({
  header,
  children,
  rowGap = 'm',
}: {
  header: ReactNode
  children: ReactNode
  rowGap?: 'xs' | 'm' | 'l'
}) => (
  <div className="dark:bg-polar-950 dark:border-polar-800 flex w-full max-w-[20rem] flex-col rounded-2xl border border-gray-200 bg-gray-100 p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]">
    <Box
      alignItems="center"
      justifyContent="between"
      columnGap="l"
      paddingHorizontal="l"
      paddingVertical="m"
    >
      {header}
    </Box>
    <div className="dark:bg-polar-900 flex w-full flex-col overflow-hidden rounded-xl bg-white">
      <Box flexDirection="column" rowGap={rowGap} padding="l">
        {children}
      </Box>
    </div>
  </div>
)

const Status = ({
  done,
  color,
  shimmer = false,
  children,
}: {
  done: boolean
  color: 'inverse' | 'muted'
  shimmer?: boolean
  children: string
}) => (
  <Text variant="body" color={color}>
    <Box as="span" display="inline-flex" alignItems="center" columnGap="s">
      {done ? (
        <Check size={14} />
      ) : (
        <LoaderCircle size={14} className="animate-spin" />
      )}
      <Shimmer active={shimmer && !done}>{children}</Shimmer>
    </Box>
  </Text>
)

const METER_STEPS = 10
const METER_DURATIONS = [
  ...Array.from({ length: METER_STEPS }, () => 1000),
  1600,
  500,
]
export const MeterVignette = () => {
  const { ref, step } = useSteps(METER_DURATIONS, METER_STEPS - 1)
  const progress = Math.min(step, METER_STEPS - 1)
  const tokens = 4.2 + progress * 0.31

  return (
    <Box
      ref={ref}
      width="100%"
      justifyContent="center"
      opacity={step === METER_DURATIONS.length - 1 ? 0 : 1}
      transitionProperty="opacity"
      transitionDuration="slower"
    >
      <Card
        rowGap="l"
        header={
          <>
            <Box alignItems="center" columnGap="xs">
              <LogoIcon size={12} />
              <Text variant="caption" color="muted">
                Meter
              </Text>
            </Box>
            <Text variant="caption" monospace color="muted">
              tokens.out
            </Text>
          </>
        }
      >
        <Box flexDirection="column" rowGap="xs">
          <Text variant="caption" color="muted">
            Acme Inc · this cycle
          </Text>
          <Text variant="heading-xxs" tabularNums>
            {tokens.toFixed(1)}M
            <Text as="span" variant="heading-xxs" color="muted">
              {' '}
              tokens
            </Text>
          </Text>
        </Box>
        <Box flexDirection="column" rowGap="m">
          <Box
            display="block"
            height="0.2rem"
            backgroundColor="background-card"
            overflow="hidden"
          >
            <Box
              height="100%"
              width={`${24 + progress * 6.5}%`}
              backgroundColor="background-inverse"
              transitionProperty="all"
              transitionDuration="slower"
            />
          </Box>
          <Box justifyContent="between" columnGap="l">
            <Text variant="caption" color="muted" tabularNums>
              ${(tokens * 2).toFixed(2)} at $2.00 / 1M
            </Text>
            <Text variant="caption" color="muted">
              Nov 1
            </Text>
          </Box>
        </Box>
      </Card>
    </Box>
  )
}

const CHECKOUT_DURATIONS = [2200, 1300, 1800]

export const CheckoutVignette = () => {
  const { ref, step } = useSteps(CHECKOUT_DURATIONS, 0)

  return (
    <Box ref={ref} width="100%" justifyContent="center">
      <Card
        rowGap="l"
        header={
          <>
            <Box alignItems="center" columnGap="xs">
              <LogoIcon size={12} />
              <Text variant="caption" color="muted">
                Checkout
              </Text>
            </Box>
            <Text variant="caption" color="muted">
              Secure
            </Text>
          </>
        }
      >
        <Box justifyContent="between" alignItems="baseline" columnGap="xl">
          <Text variant="body">Pro plan</Text>
          <Text variant="body" color="muted" tabularNums>
            $20/mo
          </Text>
        </Box>
        <Box
          justifyContent="center"
          paddingVertical="s"
          borderRadius="full"
          backgroundColor="background-inverse"
        >
          {step === 0 ? (
            <Text variant="body" color="inverse">
              Pay $20
            </Text>
          ) : (
            <Status done={step === 2} color="inverse">
              {step === 2 ? 'Paid' : 'Processing'}
            </Status>
          )}
        </Box>
      </Card>
    </Box>
  )
}

const PAYOUTS = ['$9,311', '$10,204', '$8,760']
const PAYOUT_DURATIONS = PAYOUTS.flatMap(() => [2400, 2200])

export const PayoutVignette = () => {
  const { ref, step } = useSteps(PAYOUT_DURATIONS, 1)
  const arrived = step % 2 === 1

  return (
    <Box ref={ref} width="100%" justifyContent="center">
      <Card
        rowGap="xs"
        header={
          <>
            <Box alignItems="center" columnGap="xs">
              <LogoIcon size={12} />
              <Text variant="caption" color="muted">
                Payout
              </Text>
            </Box>
            <Text variant="caption" color="muted">
              SEB •••• 9128
            </Text>
          </>
        }
      >
        <Box justifyContent="between" alignItems="baseline" columnGap="l">
          <Text variant="body">Acme Inc</Text>
          <Text variant="heading-xxs" tabularNums>
            {PAYOUTS[Math.floor(step / 2)]}
          </Text>
        </Box>
        <Box paddingTop="s">
          <Status done={arrived} color="muted" shimmer>
            {arrived ? 'Completed' : 'Wiring payout...'}
          </Status>
        </Box>
      </Card>
    </Box>
  )
}
