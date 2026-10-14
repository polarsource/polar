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

/** The pricing models a plan is composed of, as small outlined tags. */
const Models = ({ models }: { models: string[] }) => (
  <Box columnGap="xs" rowGap="xs" flexWrap="wrap">
    {models.map((m) => (
      <Box
        key={m}
        alignItems="center"
        paddingHorizontal="s"
        height={22}
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        borderRadius="full"
      >
        <Text variant="caption" color="muted">
          {m}
        </Text>
      </Box>
    ))}
  </Box>
)

/** A plan: its lines up top, the models it combines anchored at the bottom. */
const Plan = ({
  name,
  aside,
  models,
  children,
}: {
  name: string
  aside: string
  models: string[]
  children: ReactNode
}) => (
  <Sheet
    title={name}
    aside={
      <Text variant="caption" color="muted">
        {aside}
      </Text>
    }
  >
    <Box flexDirection="column" rowGap="s">
      {children}
    </Box>
    <Box
      marginTop="auto"
      paddingTop="l"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Models models={models} />
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
  <Window flow={1} aside="Three ways to sell the same product">
    <Grid templateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }} gap="xs">
      <Plan name="Team" aside="Per seat" models={['Seats', 'Metered', 'Trial']}>
        <Line label="Per seat" value="$40 / month" />
        <Line label="Seats" value="12" />
        <Line label="Output tokens" value="$3.00 / 1M" />
        <Line label="Trial" value="14 days" />
      </Plan>
      <Plan
        name="Pro"
        aside="Commit and draw down"
        models={['Fixed', 'Credits', 'Metered']}
      >
        <Line label="Base" value="$2,499 / month" />
        <Line label="Credits" value="40,000 / month" />
        <Line label="Output tokens" value="$2.00 / 1M" />
        <Line label="Tool calls" value="$0.005 / call" />
      </Plan>
      <Plan
        name="API"
        aside="Pay as you go"
        models={['Metered', 'Graduated tiers']}
      >
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
            <Box width={72} flexShrink={0}>
              <Text variant="caption" color="muted">
                {tier.range}
              </Text>
            </Box>
            <div className="dark:bg-polar-800 h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
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
