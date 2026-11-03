'use client'

import LogoType from '@/components/Brand/logos/LogoType'
import { useInView } from '@/hooks/useInView'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, CreditCard, LoaderCircle } from '@polar-sh/orbit/icons'
import { useEffect, useState, type ReactNode } from 'react'
import { Shimmer } from '../Shimmer'
import { FLOW, Sheet } from './Frame'

/** One loop of the cycle, in milliseconds: credits drain, usage takes over, the invoice settles. */
const LOOP = 13_000
const CREDITS = 40_000
const PLAN = 2_499
const OVERAGE = 1_284.3
/** Where in the loop each beat ends, as a fraction of it. */
const DRAINED = 0.48
const ACCRUED = 0.82
const SETTLED = 0.9

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 2)

/** The loop's position, 0 to 1, advanced per frame while the figure is on screen. */
const useLoop = () => {
  const { ref, inView } = useInView()
  const [t, setT] = useState(0)
  useEffect(() => {
    if (!inView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const still = window.setTimeout(() => setT(SETTLED + 0.02), 0)
      return () => clearTimeout(still)
    }
    let frame = 0
    let start = 0
    const tick = (now: number) => {
      if (!start) start = now
      setT(((now - start) % LOOP) / LOOP)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView])
  return { ref, t }
}

const Line = ({
  label,
  value,
  muted = true,
}: {
  label: string
  value: ReactNode
  muted?: boolean
}) => (
  <Box justifyContent="between" alignItems="baseline" columnGap="l">
    <Text variant="default" color="muted">
      {label}
    </Text>
    <Text variant="default" color={muted ? 'muted' : 'default'} tabularNums>
      {value}
    </Text>
  </Box>
)

/** Fig. 03: Acme's prepaid credits run out, usage billing takes over, and one invoice settles both. */
export const ChargeFigure = () => {
  const { ref, t } = useLoop()
  const left = Math.round(CREDITS * (1 - ease(t / DRAINED)))
  const overage =
    t < DRAINED ? 0 : OVERAGE * ease((t - DRAINED) / (ACCRUED - DRAINED))
  const total = PLAN + overage
  const state = t < ACCRUED ? 'open' : t < SETTLED ? 'charging' : 'paid'

  return (
    <div
      ref={ref}
      className={`dark:border-polar-800 relative w-full overflow-hidden rounded-md border border-gray-200 bg-cover bg-center p-4 md:p-12 ${FLOW[3]}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
      <div className="dark:bg-polar-950 dark:border-polar-800 relative mx-auto flex w-full max-w-[56rem] flex-col rounded-2xl border border-gray-200 bg-gray-100 p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]">
        <Box
          alignItems="center"
          justifyContent="between"
          paddingHorizontal="xl"
          paddingVertical="m"
        >
          <LogoType height={14} />
          <Text variant="caption" color="muted">
            Acme Inc on Business
          </Text>
        </Box>
        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap="xs">
          <Sheet
            title="Credits"
            aside={
              <Text variant="caption" color="muted">
                {left > 0 ? 'Drawing down' : 'Used up'}
              </Text>
            }
          >
            <Box flexDirection="column" rowGap="xs">
              <Text variant="heading-xs" tabularNums>
                {left.toLocaleString('en-US')}
                <Text as="span" variant="heading-xs" color="muted">
                  {' '}
                  / {CREDITS.toLocaleString('en-US')}
                </Text>
              </Text>
              <Text variant="caption" color="muted">
                Granted with the plan, spent first
              </Text>
            </Box>
            <div className="dark:bg-polar-800 h-1 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${(left / CREDITS) * 100}%` }}
              />
            </div>
            <Box
              paddingTop="l"
              borderTopWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              flexDirection="column"
              rowGap="xs"
            >
              <Text variant="caption" color="muted">
                Usage beyond credits
              </Text>
              <Text
                variant="heading-xs"
                tabularNums
                color={overage > 0 ? 'default' : 'muted'}
              >
                {money(overage)}
              </Text>
            </Box>
          </Sheet>
          <Sheet
            title="November Invoice"
            aside={
              <Box
                alignItems="center"
                columnGap="xs"
                color="text-secondary"
                height={16}
              >
                {state === 'open' ? null : (
                  <Box
                    width={12}
                    height={12}
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    {state === 'paid' ? (
                      <Check size={12} />
                    ) : (
                      <LoaderCircle size={12} className="animate-spin" />
                    )}
                  </Box>
                )}
                <Text variant="caption" color="muted">
                  {state === 'paid' ? (
                    'Paid'
                  ) : state === 'charging' ? (
                    <Shimmer active>Charging</Shimmer>
                  ) : (
                    'Open'
                  )}
                </Text>
              </Box>
            }
          >
            <Box flexDirection="column" rowGap="s">
              <Line label="Business plan" value={money(PLAN)} />
              <Line label="40,000 credits" value="Included" />
              <Line
                label="Usage beyond credits"
                value={overage > 0 ? money(overage) : '—'}
              />
            </Box>
            <Box
              justifyContent="between"
              alignItems="baseline"
              paddingTop="m"
              marginTop="auto"
              borderTopWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
            >
              <Box alignItems="center" columnGap="s">
                <CreditCard size={14} />
                <Text variant="body">Visa •••• 4242</Text>
              </Box>
              <Text variant="heading-xxs" tabularNums>
                {money(total)}
              </Text>
            </Box>
          </Sheet>
        </Grid>
      </div>
    </div>
  )
}
