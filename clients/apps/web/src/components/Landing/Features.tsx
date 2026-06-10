import Link from 'next/link'
import { CreditArc } from './graphics/CreditArc'
import { CycleArrow } from './graphics/CycleArrow'
import { LinkedRings } from './graphics/LinkedRings'
import { VectorField } from './graphics/VectorField'
import { VennCluster } from './graphics/VennCluster'
import { WaveBars } from './graphics/WaveBars'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'

const TILES = [
  {
    title: 'Usage Billing',
    desc: 'Meter tokens, API calls, compute, storage. Bill with precision down to the event.',
    href: '/features/usage-billing',
    Graphic: VennCluster,
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-y-12 md:gap-y-16">
      <Box
        display="flex"
        flexDirection={{ base: 'column', xl: 'row' }}
        rowGap="2xl"
      >
        <Box display="flex" flex={1}>
          <Text variant="heading-xl" as="h2" wrap="balance">
            Ship any pricing model in an afternoon
          </Text>
        </Box>
        <Box
          display="flex"
          flex={1}
          flexDirection="column"
          rowGap="xl"
          justifyContent="between"
        >
          <Box
            borderTopWidth={4}
            borderColor="border-primary"
            width="3rem"
            display={{ base: 'none', xl: 'flex' }}
          />
          <Text variant="heading-xs" wrap="pretty">
            Subscriptions, usage, seats, credits, trials, and discounts. Compose
            them however your product charges.
          </Text>
        </Box>
      </Box>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TILES.map((tile) => {
          const G = tile.Graphic
          return (
            <Link
              key={tile.title}
              href={tile.href}
              className="dark:bg-polar-900 dark:hover:bg-polar-800 flex flex-col bg-gray-50 transition-colors hover:bg-gray-100"
            >
              <div className="flex flex-col gap-8 p-8">
                <span className="font-display text-3xl text-gray-900 dark:text-white">
                  {tile.title}
                </span>
                <div className="dark:bg-polar-600 h-[2px] w-10 bg-gray-200" />
                <span className="dark:text-polar-500 text-xl text-gray-500">
                  {tile.desc}
                </span>
              </div>
              <div className="mt-auto aspect-square w-full px-8">
                <G />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
