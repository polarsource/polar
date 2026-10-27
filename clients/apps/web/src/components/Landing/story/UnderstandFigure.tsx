'use client'

import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useMemo } from 'react'
import { MarginChart } from '../chapters/MarginChart'
import { useTweenedValues } from '../chapters/useTweened'
import { dollars, percent, useUsageStream } from '../chapters/useUsageStream'
import { Sheet, Window } from './Frame'

/** Margin per customer this cycle. Acme matches the live chart; one customer runs below cost. */
const CUSTOMERS = [
  { name: 'Acme Inc', plan: 'Business', margin: 0.61 },
  { name: 'Northwind', plan: 'Business', margin: 0.62 },
  { name: 'Lumen', plan: 'Team', margin: 0.51 },
  { name: 'Atlas', plan: 'Flex', margin: -0.27 },
]

/** Fig. 04: Acme's revenue against inference cost as events stream in, and the margin of every customer. */
export const UnderstandFigure = () => {
  const { ref, totals, series, margin } = useUsageStream()
  const [cost, marginShown] = useTweenedValues(
    useMemo(() => [totals.cost, margin], [totals, margin]),
  )

  return (
    <Window flow={1} innerRef={ref} aside="Acme Inc">
      <Grid templateColumns={{ base: '1fr', lg: '3fr 2fr' }} gap="xs">
        <Sheet title="Unit economics">
          <Box justifyContent="between" alignItems="start" columnGap="l">
            <Box flexDirection="column" rowGap="xs">
              <Text variant="caption" color="muted">
                Gross margin
              </Text>
              <Text variant="heading-xs" tabularNums>
                {percent(marginShown)}
              </Text>
            </Box>
            <Box flexDirection="column" rowGap="xs" alignItems="end">
              <Text variant="caption" color="muted">
                Inference cost
              </Text>
              <Text variant="heading-xs" tabularNums>
                {dollars(cost, 2)}
              </Text>
            </Box>
          </Box>
          <Box display="flex" flexDirection="column" height="18rem">
            <MarginChart series={series} />
          </Box>
        </Sheet>
        <Sheet title="Margin by customer">
          <Box flexDirection="column" rowGap="m">
            {CUSTOMERS.map((c) => (
              <Box
                key={c.name}
                justifyContent="between"
                alignItems="baseline"
                columnGap="l"
              >
                <Box alignItems="baseline" columnGap="s">
                  <Text variant="default">{c.name}</Text>
                  <Text variant="default" color="muted">
                    {c.plan}
                  </Text>
                </Box>
                <Box alignItems="center" columnGap="xs">
                  <Text
                    variant="default"
                    color={c.margin < 0 ? 'danger' : 'default'}
                    tabularNums
                  >
                    {percent(c.margin)}
                  </Text>
                </Box>
              </Box>
            ))}
          </Box>
          <Box
            marginTop="auto"
            paddingTop="l"
            borderTopWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            flexDirection="column"
            rowGap="s"
          >
            <Text variant="caption" color="muted">
              Attach the cost to the events you already send
            </Text>
            <pre className="m-0 overflow-x-auto font-mono text-[13px] leading-6 text-white">
              {"_cost: { amount: 0.0021, currency: 'usd' }"}
            </pre>
          </Box>
        </Sheet>
      </Grid>
    </Window>
  )
}
