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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-y-12 py-32 md:gap-y-24">
      <h1 className="font-display px-4 text-4xl leading-snug md:px-0 md:text-7xl">
        All billing primitives you need.
        <br />
        In a single API.
      </h1>

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
                <div className="indigo-500 h-[2px] w-10 dark:bg-indigo-500" />
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
