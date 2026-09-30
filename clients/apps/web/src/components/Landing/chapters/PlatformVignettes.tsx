'use client'

import { useInView } from '@/hooks/useInView'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, LoaderCircle } from 'lucide-react'
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

const Card = ({
  children,
  rowGap = 'm',
}: {
  children: ReactNode
  rowGap?: 'xs' | 'm' | 'l'
}) => (
  <Box
    flexDirection="column"
    rowGap={rowGap}
    backgroundColor="background-card"
    padding="xl"
    width="100%"
    maxWidth="19rem"
  >
    {children}
  </Box>
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

  return (
    <Box
      ref={ref}
      width="100%"
      justifyContent="center"
      opacity={step === METER_DURATIONS.length - 1 ? 0 : 1}
      transitionProperty="opacity"
      transitionDuration="slower"
    >
      <Card>
        <Box alignItems="center" columnGap="s">
          <Box
            width={20}
            height={20}
            alignItems="center"
            justifyContent="center"
            backgroundColor="background-secondary"
          >
            <Text variant="caption">L</Text>
          </Box>
          <Text variant="body" color="muted">
            Lumen
          </Text>
        </Box>
        <Box justifyContent="between" alignItems="baseline" columnGap="l">
          <Text variant="body" monospace>
            gpt-4o
          </Text>
          <Text variant="body" color="muted" tabularNums>
            {(0.3 + progress * 0.1).toFixed(1)}M tokens
          </Text>
        </Box>
        <Box
          display="block"
          height="0.2rem"
          backgroundColor="background-secondary"
          overflow="hidden"
        >
          <Box
            height="100%"
            width={`${20 + progress * 8}%`}
            backgroundColor="background-inverse"
            transitionProperty="all"
            transitionDuration="slower"
          />
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
      <Card rowGap="l">
        <Box justifyContent="between" alignItems="baseline" columnGap="xl">
          <Text variant="body">Pro plan</Text>
          <Text variant="body" color="muted">
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
      <Card rowGap="xs">
        <Box justifyContent="between" alignItems="baseline" columnGap="l">
          <Text variant="body">Payout</Text>
          <Text variant="body" tabularNums>
            {PAYOUTS[Math.floor(step / 2)]}
          </Text>
        </Box>
        <Text variant="body" color="muted">
          Acme Inc · SEB **** 9128
        </Text>
        <Box paddingTop="s">
          <Status done={arrived} color="muted" shimmer>
            {arrived ? 'Completed' : 'Wiring payout...'}
          </Status>
        </Box>
      </Card>
    </Box>
  )
}
