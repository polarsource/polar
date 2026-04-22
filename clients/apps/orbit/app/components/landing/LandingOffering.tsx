'use client'

import { SectionHeading } from './SectionHeading'
import { WaveBars } from '../WaveBars'
import { VectorField } from '../VectorField'
import { MagneticBubbles } from '../MagneticBubbles'
import { CircularBand } from '../CircularBand'

/**
 * LandingOffering — 2×2 grid of product tiles, each with a graphic
 * component + title + description expanding on Polar's offering.
 */

const TILES = [
  {
    title: 'Usage Billing',
    desc: 'Meter tokens, API calls, compute, storage — bill with precision down to the event.',
    Graphic: WaveBars,
  },
  {
    title: 'Subscriptions',
    desc: 'Recurring plans with trials, upgrades, proration, and dunning built in.',
    Graphic: VectorField,
  },
  {
    title: 'Seats',
    desc: "Per-seat pricing that scales with your customers' teams. Add, remove, prorate automatically.",
    Graphic: MagneticBubbles,
  },
  {
    title: 'Digital Goods',
    desc: 'Sell licenses, downloads, credits, and one-time digital products with a single API call.',
    Graphic: CircularBand,
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
              <G field={(r, θ) => θ + Math.PI / 2} />
            </div>
            <div className="flex flex-col gap-4 p-12">
              <h3 className="text-2xl font-normal text-neutral-900 dark:text-white">
                {tile.title}
              </h3>
              <p className="text-2xl text-neutral-500">{tile.desc}</p>
            </div>
          </div>
        )
      })}
    </div>
  </section>
)
