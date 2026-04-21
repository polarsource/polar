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
    <div className="grid grid-cols-1 gap-2 p-2 md:grid-cols-2">
      {/* Left — heading + description */}
      <div className="dark:bg-dark-900 flex flex-col justify-center bg-neutral-50 p-16 py-24">
        <SectionHeading>
          Everything you
          <br />
          need to get paid
        </SectionHeading>
        <p className="mt-8 max-w-md text-xl text-neutral-500">
          Beyond metering — a full commerce platform for subscriptions,
          checkout, wallets, and more.
        </p>
      </div>

      {/* Right — 2×2 tile grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
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
              <div className="flex flex-col gap-2 p-8">
                <h3 className="text-lg font-normal text-neutral-900 dark:text-white">
                  {tile.title}
                </h3>
                <p className="text-base text-neutral-500">{tile.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  </section>
)
