'use client'

import { useInView } from '@/hooks/useInView'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Check, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Shimmer } from '../Shimmer'
import { Sheet, Window } from './Frame'

/** Acme's renewal, in the currency it pays in, and where the tax on it goes. */
const MARKETS = [
  { market: 'Germany', rate: 'VAT 19%', amount: '€711.82' },
  { market: 'United States', rate: 'Sales tax', amount: '$184.20' },
  { market: 'United Kingdom', rate: 'VAT 20%', amount: '£96.44' },
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

/** Fig. 05: Acme pays in euros with tax included, Polar remits the tax per market, and the payout lands. */
export const SellFigure = () => {
  const { ref, beat, round } = useBeat()
  const paid = beat >= 1
  const landed = beat === 3

  return (
    <Window innerRef={ref} aside="Polar is the merchant of record">
      <Grid templateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }} gap="xs">
        <Sheet
          title="Checkout"
          aside={
            <Text variant="caption" color="muted">
              Berlin · EUR
            </Text>
          }
        >
          <Box flexDirection="column" rowGap="s">
            <Box justifyContent="between" columnGap="l">
              <Text variant="default" color="muted">
                Pro plan
              </Text>
              <Text variant="default" color="muted" tabularNums>
                €2,299.00
              </Text>
            </Box>
            <Box justifyContent="between" columnGap="l">
              <Text variant="default" color="muted">
                VAT 19%
              </Text>
              <Text variant="default" color="muted" tabularNums>
                €436.81
              </Text>
            </Box>
          </Box>
          <Box
            justifyContent="between"
            alignItems="baseline"
            paddingTop="m"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
          >
            <Text variant="body">Acme Inc pays</Text>
            <Text variant="heading-xxs" tabularNums>
              €2,735.81
            </Text>
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
          <Box flexDirection="column" rowGap="m">
            {MARKETS.map((m) => (
              <Box
                key={m.market}
                justifyContent="between"
                alignItems="baseline"
                columnGap="l"
              >
                <Box flexDirection="column">
                  <Text variant="default">{m.market}</Text>
                  <Text variant="caption" color="muted">
                    {m.rate}
                  </Text>
                </Box>
                <Text variant="default" color="muted" tabularNums>
                  {m.amount}
                </Text>
              </Box>
            ))}
          </Box>
          <Box marginTop="auto">
            <Status done>Collected and remitted by Polar</Status>
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
          <Box flexDirection="column" rowGap="xs">
            <Text variant="caption" color="muted">
              To your bank account
            </Text>
            <div
              key={round}
              className="[animation:appear_360ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
            >
              <Text variant="heading-xs" tabularNums>
                {PAYOUTS[round]}
              </Text>
            </div>
          </Box>
          <Text variant="caption" color="muted">
            Revenue net of fees, every week. No tax liability on your books.
          </Text>
          <Box marginTop="auto">
            {beat >= 2 ? (
              <Status done={landed}>
                {landed ? 'Landed' : 'Wiring payout'}
              </Status>
            ) : (
              <Box height={16}>
                <Text variant="caption" color="muted">
                  Next payout Friday
                </Text>
              </Box>
            )}
          </Box>
        </Sheet>
      </Grid>
    </Window>
  )
}
