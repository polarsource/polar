import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { MarginPulse } from './graphics/MarginPulse'
import { SectionHeader } from './SectionHeader'

interface MarginRow {
  name: string
  plan: string
  tokens: string
  revenue: number
  cost: number
}

const ROWS: MarginRow[] = [
  {
    name: 'Jane Doe',
    plan: 'Enterprise',
    tokens: '4.1M tokens',
    revenue: 4200,
    cost: 294,
  },
  {
    name: 'John Doe',
    plan: 'Growth',
    tokens: '3.3M tokens',
    revenue: 1800,
    cost: 234,
  },
  {
    name: 'Emily Carter',
    plan: 'Growth',
    tokens: '2.6M tokens',
    revenue: 920,
    cost: 184,
  },
  {
    name: 'Michael Chen',
    plan: 'Hobby',
    tokens: '5.5M tokens',
    revenue: 480,
    cost: 389,
  },
  {
    name: 'Sarah Müller',
    plan: 'Hobby',
    tokens: '8.7M tokens',
    revenue: 90,
    cost: 612,
  },
]

const currency = (value: number) =>
  `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`

const marginPercent = (row: MarginRow) =>
  Math.round(((row.revenue - row.cost) / row.revenue) * 100)

const GRID_COLUMNS = {
  base: '1.4fr 1.2fr',
  md: '1.8fr 0.9fr 0.9fr 1.5fr',
}

export const CostInsights = () => {
  return (
    <Box
      position="relative"
      flexDirection="column"
      rowGap={{ base: '2xl', md: '4xl' }}
      paddingTop={{ base: 'l', md: '3xl' }}
      paddingBottom={{ base: '2xl', md: '4xl' }}
    >
      <SectionHeader
        title="Your power users cost you money"
        description="Polar breaks down LLM spend customer by customer, so you catch the ones bleeding your margins before they bleed your runway."
      />

      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }}
        gap="l"
      >
        {/* Animated margin graphic */}
        <Box
          minHeight={{ base: '14rem', lg: 'auto' }}
          overflow="hidden"
          backgroundColor="background-secondary"
          flexDirection="column"
          justifyContent="between"
          padding="xl"
          rowGap="l"
        >
          <Box display="block" flex={1} minHeight={0} aspectRatio="1/1">
            <MarginPulse />
          </Box>
        </Box>

        {/* Leaderboard */}
        <Box
          gridColumn={{ base: 'auto', lg: 'span 2' }}
          overflow="hidden"
          backgroundColor="background-secondary"
          display={{ base: 'none', md: 'block' }}
        >
          {/* Column headers */}
          <Box
            display="grid"
            gridTemplateColumns={GRID_COLUMNS}
            alignItems="center"
            columnGap="l"
            paddingHorizontal={{ base: 'l', md: '2xl' }}
            paddingVertical="m"
            borderBottomWidth={1}
            borderStyle="solid"
            borderColor="border-secondary"
          >
            <Text color="muted">Customer</Text>
            <Text color="muted" align="right">
              Revenue
            </Text>
            <Text color="muted" align="right">
              LLM cost
            </Text>
            <Text color="muted" align="right">
              Gross margin
            </Text>
          </Box>

          {/* Rows */}
          {ROWS.map((row, index) => {
            const margin = marginPercent(row)
            const negative = margin < 0
            return (
              <Box
                key={row.name}
                display="grid"
                gridTemplateColumns={GRID_COLUMNS}
                alignItems="center"
                columnGap="l"
                paddingHorizontal={{ base: 'l', md: '2xl' }}
                paddingVertical="l"
                borderBottomWidth={index === ROWS.length - 1 ? 0 : 1}
                borderStyle="solid"
                borderColor="border-secondary"
              >
                <Box alignItems="center" columnGap="m">
                  <Box flexDirection="column" rowGap="xs">
                    <Text>{row.name}</Text>
                    <Text color="muted">
                      {row.plan} · {row.tokens}
                    </Text>
                  </Box>
                </Box>
                <Text align="right">{currency(row.revenue)}</Text>
                <Text align="right" color="muted">
                  {currency(row.cost)}
                </Text>
                <Box alignItems="center" justifyContent="end" columnGap="m">
                  <Text align="right" color={negative ? 'danger' : undefined}>
                    {margin > 0 ? '+' : ''}
                    {margin}%
                  </Text>
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
