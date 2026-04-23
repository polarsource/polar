'use client'

import { Dumbbell } from '../Dumbbell'
import { CycleArrow } from '../CycleArrow'
import { LinkedRings } from '../LinkedRings'
import { CreditArc } from '../CreditArc'

/**
 * LandingOffering — 2×2 grid of product tiles, each with a graphic
 * component + title + description expanding on Polar's offering.
 */

const TILES = [
  {
    title: 'Usage Billing',
    desc: 'Meter tokens, API calls, compute, storage — bill with precision down to the event.',
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
    desc: 'Let customers prepay and draw down over time — like a wallet for your API.',
    Graphic: CreditArc,
  },
]

export const LandingOffering = () => (
  <section>
    {/* Right — 2×2 tile grid */}
    <div className="m-2 grid grid-cols-1 gap-2 pt-2 sm:grid-cols-4">
      {TILES.map((tile) => {
        const G = tile.Graphic
        return (
          <div
            key={tile.title}
            className="dark:bg-dark-900 flex flex-col bg-neutral-50"
          >
            <div className="aspect-square w-full">
              <G />
            </div>
            <div className="flex flex-col gap-2 px-12 py-12 text-3xl">
              <span className="text-neutral-900 dark:text-neutral-300">
                {tile.title}
              </span>
              <span className="dark:text-dark-300 text-neutral-500">
                {tile.desc}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  </section>
)
