import Link from 'next/link'
import { CycleArrow } from './graphics/CycleArrow'
import { LinkedRings } from './graphics/LinkedRings'
import { VennCluster } from './graphics/VennCluster'

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
]

export const Features = () => {
  return (
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
  )
}
