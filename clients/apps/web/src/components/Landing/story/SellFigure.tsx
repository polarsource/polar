'use client'

import { useInView } from '@/hooks/useInView'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, LoaderCircle } from '@polar-sh/orbit/icons'
import { useEffect, useState } from 'react'
import { Shimmer } from '../Shimmer'
import { Sheet, Window } from './Frame'

/** Where the tax on this quarter's sales went, by market. */
const MARKETS = [
  { market: 'Germany', rate: 'VAT 19%', amount: '€711.82' },
  { market: 'the US', rate: 'Sales tax', amount: '$184.20' },
  { market: 'the UK', rate: 'VAT 20%', amount: '£96.44' },
]
const PAYOUTS = ['$41,208.60', '$38,915.12', '$44,630.08']
/** The loop's beats: paying, paid, payout wiring, payout landed. */
const BEATS = [1800, 1400, 2000, 2200]

const useBeat = () => {
  const { ref, inView } = useInView()
  const [beat, setBeat] = useState(0)
  const [round, setRound] = useState(0)
  useEffect(() => {
    if (!inView) return
    const timer = window.setTimeout(() => {
      setBeat((b) => (b + 1) % BEATS.length)
      if (beat === BEATS.length - 1) setRound((r) => (r + 1) % PAYOUTS.length)
    }, BEATS[beat])
    return () => clearTimeout(timer)
  }, [inView, beat])
  return { ref, beat, round }
}

const Status = ({ done, children }: { done: boolean; children: string }) => (
  <Box alignItems="center" columnGap="s" color="text-secondary" height={16}>
    <Box
      width={12}
      height={12}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      {done ? (
        <Check size={12} />
      ) : (
        <LoaderCircle size={12} className="animate-spin" />
      )}
    </Box>
    <Text variant="caption" color="muted">
      {done ? children : <Shimmer active>{children}</Shimmer>}
    </Text>
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

/** Fig. 05: Acme pays in euros with VAT included, Polar remits the tax per market, and the payout lands. */
export const SellFigure = () => {
  const { ref, beat, round } = useBeat()
  const paid = beat >= 1
  const landed = beat === 3

  return (
    <Window flow={2} innerRef={ref}>
      <Grid templateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }} gap="xs">
        <Sheet
          title="Checkout"
          aside={
            <Text variant="caption" color="muted">
              Acme Inc in Berlin
            </Text>
          }
        >
          <Text variant="heading-xs" tabularNums>
            €2,735.81
          </Text>
          <Box flexDirection="column" rowGap="s">
            <Line label="Business plan" value="€2,299.00" />
            <Line label="VAT 19%" value="€436.81" />
          </Box>
          <Box marginTop="auto">
            <Status done={paid}>{paid ? 'Paid' : 'Processing'}</Status>
          </Box>
        </Sheet>
        <Sheet
          title="Tax"
          aside={
            <Text variant="caption" color="muted">
              This quarter
            </Text>
          }
        >
          <Box flexDirection="column" rowGap="s">
            {MARKETS.map((m) => (
              <Line
                key={m.market}
                label={`${m.rate} in ${m.market}`}
                value={m.amount}
              />
            ))}
          </Box>
          <Box marginTop="auto">
            <Status done>Remitted by Polar</Status>
          </Box>
        </Sheet>
        <Sheet
          title="Payout"
          aside={
            <Text variant="caption" color="muted">
              SEB •••• 9128
            </Text>
          }
        >
          <div
            key={round}
            className="[animation:appear_360ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
          >
            <Text variant="heading-xs" tabularNums>
              {PAYOUTS[round]}
            </Text>
          </div>
          <Box
            marginTop="auto"
            justifyContent="between"
            alignItems="center"
            columnGap="l"
          >
            {beat >= 2 ? (
              <Status done={landed}>
                {landed ? 'Landed' : 'Payout requested'}
              </Status>
            ) : (
              <Box height={16} alignItems="center">
                <Text variant="caption" color="muted">
                  Balance ready to withdraw
                </Text>
              </Box>
            )}
            {/* Pressed while the payout is on its way, ready again once it lands. */}
            <div
              className={`flex h-7 items-center rounded-full bg-white px-3 transition-opacity duration-300 ${beat === 2 ? 'opacity-40' : 'opacity-100'}`}
            >
              <span className="text-black">
                <Text variant="caption" color="inherit">
                  Withdraw
                </Text>
              </span>
            </div>
          </Box>
        </Sheet>
      </Grid>
    </Window>
  )
}
