import { Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import type { ReactNode } from 'react'
import { Sheet, Window } from './Frame'

const Line = ({ label, value }: { label: string; value: string }) => (
  <Box justifyContent="between" alignItems="baseline" columnGap="l">
    <Text variant="default" color="muted">
      {label}
    </Text>
    <Text variant="default" tabularNums>
      {value}
    </Text>
  </Box>
)

/** A plan: its lines up top, and a create action anchored at the bottom. */
const Plan = ({
  name,
  aside,
  children,
}: {
  name: string
  aside: string
  children: ReactNode
}) => (
  <Sheet title={name} subtitle={aside}>
    <Box flexDirection="column" rowGap="s">
      {children}
    </Box>
    <Box marginTop="auto" paddingTop="l">
      <div className="dark:bg-polar-800 flex h-7 items-center rounded-full bg-gray-100 px-3">
        <Text variant="caption">Create Product</Text>
      </div>
    </Box>
  </Sheet>
)

const TIERS = [
  { range: 'First 1B', price: '$2.00', width: '100%' },
  { range: 'Next 4B', price: '$1.60', width: '72%' },
  { range: 'Beyond 5B', price: '$1.20', width: '28%' },
]

/** Fig. 01: three plans composed from different pricing models, all on Polar. */
export const DefineFigure = () => (
  <Window flow={1} aside="Example plans for your product">
    <Grid templateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }} gap="xs">
      <Plan name="Team" aside="Per seat">
        <Line label="Per seat" value="$40 / month" />
        <Line label="Seats" value="12" />
        <Line label="Output tokens" value="$3.00 / 1M" />
        <Line label="Trial" value="14 days" />
      </Plan>
      <Plan name="Business" aside="Commit & draw down">
        <Line label="Base" value="$2,499 / month" />
        <Line label="Credits" value="40,000 / month" />
        <Line label="Output tokens" value="$2.00 / 1M" />
        <Line label="Tool calls" value="$0.005 / call" />
      </Plan>
      <Plan name="Flex" aside="Pay as you go">
        <Box justifyContent="between" alignItems="baseline" columnGap="l">
          <Text variant="default" color="muted">
            Output tokens
          </Text>
          <Text variant="caption" color="muted">
            per 1M
          </Text>
        </Box>
        {TIERS.map((tier) => (
          <Box key={tier.range} alignItems="center" columnGap="m">
            <Box width={88} flexShrink={0}>
              <Text variant="default" color="muted">
                {tier.range}
              </Text>
            </Box>
            <div className="dark:bg-polar-800 h-1 flex-1 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: tier.width }}
              />
            </div>
            <Box width={48} justifyContent="end">
              <Text variant="default" tabularNums>
                {tier.price}
              </Text>
            </Box>
          </Box>
        ))}
        <Line label="No monthly fee" value="$0" />
      </Plan>
    </Grid>
  </Window>
)
