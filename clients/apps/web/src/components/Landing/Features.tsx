import { Dumbbell } from './graphics/Dumbbell'
import { CycleArrow } from './graphics/CycleArrow'
import { LinkedRings } from './graphics/LinkedRings'
import { CreditArc } from './graphics/CreditArc'
import { WaveBars } from './graphics/WaveBars'
import { VectorField } from './graphics/VectorField'

const TILES = [
  {
    title: 'Usage Billing',
    desc: 'Meter tokens, API calls, compute, storage. Bill with precision down to the event.',
    Graphic: Dumbbell,
  },
  {
    title: 'Subscriptions',
    desc: 'Recurring plans with trials, upgrades, proration, and dunning built in.',
    Graphic: CycleArrow,
  },
  {
    title: 'Seats',
    desc: "Pricing that scales with your customer's teams. Add, remove, prorate automatically.",
    Graphic: LinkedRings,
  },
  {
    title: 'Credits',
    desc: 'Prepay and draw down over time, like a wallet for your API.',
    Graphic: CreditArc,
  },
  {
    title: 'Trials',
    desc: 'Free or paid trials with automatic conversion, reminders, and grace periods.',
    Graphic: VectorField,
  },
  {
    title: 'Discounts',
    desc: 'Coupons, promo codes, and volume tiers. Applied automatically at checkout.',
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
            <div
              key={tile.title}
              className="dark:bg-polar-900 flex flex-col bg-gray-50"
            >
              <div className="flex flex-col gap-4 p-8">
                <span className="font-display text-3xl text-gray-900 dark:text-white">
                  {tile.title}
                </span>
                <span className="dark:text-polar-300 text-xl text-gray-500">
                  {tile.desc}
                </span>
              </div>
              <div className="mt-auto aspect-square w-full px-8">
                <G />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
