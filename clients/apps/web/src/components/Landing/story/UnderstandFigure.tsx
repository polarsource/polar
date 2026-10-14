'use client'

import LogoType from '@/components/Brand/logos/LogoType'
import { useInView } from '@/hooks/useInView'
import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowDown, Check, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Shimmer } from '../Shimmer'
import { Sheet } from './Frame'

/** Acme's cycle split by feature. Revenue and cost add up to the hero's totals. */
const FEATURES = [
  { name: 'Chat', model: 'gpt-5', revenue: 9_840, cost: 3_210 },
  { name: 'Search', model: 'gpt-5-mini', revenue: 4_120, cost: 930 },
  { name: 'Code review', model: 'claude-sonnet', revenue: 3_260, cost: 1_610 },
  { name: 'Research agent', model: 'o3', revenue: 1_212, cost: 1_354 },
]
const TOP = Math.max(...FEATURES.map((f) => Math.max(f.revenue, f.cost)))
const money = (v: number) => `$${v.toLocaleString('en-US')}`
const margin = (f: (typeof FEATURES)[number]) => 1 - f.cost / f.revenue

/** Whether the bars have grown in, and the signal's beat: watching, then fired. */
const useBeats = () => {
  const { ref, inView } = useInView()
  const [shown, setShown] = useState(false)
  const [fired, setFired] = useState(false)
  useEffect(() => {
    if (!inView) return
    const grow = window.setTimeout(() => setShown(true), 80)
    const cycle = window.setInterval(() => setFired((f) => !f), 3200)
    const first = window.setTimeout(() => setFired(true), 1600)
    return () => {
      clearTimeout(grow)
      clearTimeout(first)
      clearInterval(cycle)
    }
  }, [inView])
  return { ref, shown, fired }
}

/** Fig. 04: revenue against cost for each of Acme's features, and a signal firing on the one below cost. */
export const UnderstandFigure = () => {
  const { ref, shown, fired } = useBeats()

  return (
    <div
      ref={ref}
      className="dark:border-polar-800 relative w-full overflow-hidden rounded-md border border-gray-200 bg-[url(/assets/landing/company/Polar_Flow_03_No_Logo.jpg)] bg-cover bg-center p-4 md:p-12"
    >
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
      <div className="dark:bg-polar-950 dark:border-polar-800 relative flex w-full flex-col rounded-3xl border border-gray-200 bg-gray-100 p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)]">
        <Box
          alignItems="center"
          justifyContent="between"
          paddingHorizontal="xl"
          paddingVertical="m"
        >
          <LogoType height={14} />
          <Text variant="caption" color="muted">
            Acme Inc · this cycle
          </Text>
        </Box>
        <Grid templateColumns={{ base: '1fr', lg: '3fr 2fr' }} gap="xs">
          <Sheet
            title="Margin by feature"
            aside={
              <Box alignItems="center" columnGap="m">
                <Box alignItems="center" columnGap="xs">
                  <div className="dark:bg-polar-800 size-2 rounded-full bg-gray-200" />
                  <Text variant="caption" color="muted">
                    Revenue
                  </Text>
                </Box>
                <Box alignItems="center" columnGap="xs">
                  <div className="size-2 rounded-full bg-white" />
                  <Text variant="caption" color="muted">
                    Cost
                  </Text>
                </Box>
              </Box>
            }
          >
            <Box flexDirection="column" rowGap="l">
              {FEATURES.map((f) => {
                const m = margin(f)
                return (
                  <Box key={f.name} flexDirection="column" rowGap="s">
                    <Box
                      justifyContent="between"
                      alignItems="baseline"
                      columnGap="l"
                    >
                      <Box alignItems="baseline" columnGap="s">
                        <Text variant="default">{f.name}</Text>
                        <Text variant="caption" monospace color="muted">
                          {f.model}
                        </Text>
                      </Box>
                      <Box alignItems="baseline" columnGap="m">
                        <Text variant="caption" color="muted" tabularNums>
                          {money(f.revenue)} · {money(f.cost)}
                        </Text>
                        <Box
                          alignItems="center"
                          columnGap="xs"
                          minWidth={56}
                          justifyContent="end"
                        >
                          {m < 0 ? (
                            <ArrowDown size={12} className="text-red-500" />
                          ) : null}
                          <Text variant="default" tabularNums>
                            {Math.round(m * 100)}%
                          </Text>
                        </Box>
                      </Box>
                    </Box>
                    <div className="relative h-1.5 w-full rounded-full">
                      <div
                        className="dark:bg-polar-800 absolute inset-y-0 left-0 rounded-full bg-gray-200 transition-[width] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                        style={{
                          width: shown ? `${(f.revenue / TOP) * 100}%` : '0%',
                        }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] delay-150 duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                        style={{
                          width: shown ? `${(f.cost / TOP) * 100}%` : '0%',
                        }}
                      />
                    </div>
                  </Box>
                )
              })}
            </Box>
          </Sheet>
          <Sheet
            title="Signal"
            aside={
              <Text variant="caption" color="muted">
                Live
              </Text>
            }
          >
            <Text variant="caption" monospace>
              {"polar.on('margin.below', 0)"}
            </Text>
            <Box flexDirection="column" rowGap="m" flex={1}>
              {fired ? (
                <div
                  key="fired"
                  className="[animation:appear_360ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                >
                  <Box flexDirection="column" rowGap="m">
                    <Box
                      justifyContent="between"
                      alignItems="baseline"
                      columnGap="l"
                    >
                      <Text variant="body">Research agent</Text>
                      <Box alignItems="center" columnGap="xs">
                        <ArrowDown size={12} className="text-red-500" />
                        <Text variant="body" tabularNums>
                          -12%
                        </Text>
                      </Box>
                    </Box>
                    <Text variant="caption" color="muted">
                      Acme Inc · o3 costs more than it earns
                    </Text>
                    <Box
                      alignItems="center"
                      columnGap="s"
                      color="text-secondary"
                    >
                      <Check size={12} />
                      <Text variant="caption" color="muted">
                        Routed to gpt-5-mini
                      </Text>
                    </Box>
                  </Box>
                </div>
              ) : (
                <Box
                  key="watching"
                  alignItems="center"
                  columnGap="s"
                  color="text-secondary"
                >
                  <LoaderCircle size={12} className="animate-spin" />
                  <Text variant="caption" color="muted">
                    <Shimmer active>Watching margins</Shimmer>
                  </Text>
                </Box>
              )}
              <Box
                marginTop="auto"
                paddingTop="l"
                borderTopWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
              >
                <Text variant="caption" color="muted">
                  Revenue and inference cost on the same ledger, so margin is a
                  query, not a spreadsheet.
                </Text>
              </Box>
            </Box>
          </Sheet>
        </Grid>
      </div>
    </div>
  )
}
