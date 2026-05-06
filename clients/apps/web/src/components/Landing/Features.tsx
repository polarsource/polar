import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Link from 'next/link'
import { CreditArc } from './graphics/CreditArc'
import { CycleArrow } from './graphics/CycleArrow'
import { Dumbbell } from './graphics/Dumbbell'
import { LinkedRings } from './graphics/LinkedRings'
import { VectorField } from './graphics/VectorField'
import { WaveBars } from './graphics/WaveBars'

const TILES = [
  {
    title: 'Usage Billing',
    desc: 'Meter tokens, API calls, compute, storage. Bill with precision down to the event.',
    href: '/features/usage-billing',
    Graphic: Dumbbell,
  },
  {
    title: 'Subscriptions',
    desc: 'Recurring plans with trials, upgrades, proration, and dunning built in.',
    href: '/features/subscriptions',
    Graphic: CycleArrow,
  },
  {
    title: 'Seats',
    desc: "Pricing that scales with your customer's teams. Add, remove, prorate automatically.",
    href: '/features/seats',
    Graphic: LinkedRings,
  },
  {
    title: 'Credits',
    desc: 'Prepay and draw down over time, like a wallet for your API.',
    href: '/features/credits',
    Graphic: CreditArc,
  },
  {
    title: 'Trials',
    desc: 'Free or paid trials with automatic conversion, reminders, and grace periods.',
    href: '/features/trials',
    Graphic: VectorField,
  },
  {
    title: 'Discounts',
    desc: 'Coupons, promo codes, and volume tiers. Applied automatically at checkout.',
    href: '/features/discounts',
    Graphic: WaveBars,
  },
]

export const Features = () => {
  return (
    <Box
      marginHorizontal="auto"
      display="flex"
      width="100%"
      maxWidth="1280px"
      flexDirection="column"
      rowGap={{
        base: '3xl',
        md: '5xl',
      }}
      className="py-32"
    >
      <h1 className="font-display px-4 text-4xl leading-snug md:px-0 md:text-7xl">
        All billing primitives you need.
        <br />
        In a single API.
      </h1>
      <Box
        display="grid"
        gridTemplateColumns={{
          base: 'repeat(1, minmax(0, 1fr))',
          md: 'repeat(3, minmax(0, 1fr))',
        }}
        gap="l"
      >
        {TILES.map((tile) => {
          const G = tile.Graphic
          return (
            <Link
              key={tile.title}
              href={tile.href}
              className="dark:bg-polar-900 dark:hover:bg-polar-800 flex flex-col bg-gray-50 transition-colors hover:bg-gray-100"
            >
              <Box display="flex" flexDirection="column" gap="l" padding="2xl">
                <Box
                  as="span"
                  color="text-primary"
                  className="font-display text-3xl"
                >
                  {tile.title}
                </Box>
                <Text as="span" variant="heading-xxs" color="muted">
                  {tile.desc}
                </Text>
              </Box>
              <Box
                marginTop="auto"
                aspectRatio="1 / 1"
                width="100%"
                paddingHorizontal="2xl"
              >
                <G />
              </Box>
            </Link>
          )
        })}
      </Box>
    </Box>
  )
}
