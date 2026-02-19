'use client'

import { BarChart, Headline } from '@/components/Orbit'

export default function OrbitPage() {
  return (
    <div className="dark:bg-polar-950 min-h-screen bg-white text-black dark:text-white">
      <div className="flex flex-col">
        {/* Cover */}
        <div className="flex min-h-screen flex-col justify-between p-8 md:p-16">
          <div className="flex items-start justify-between">
            <span className="font-medium">Polar Software Inc</span>
            <span className="font-medium">Orbit</span>
          </div>
          <div className="flex flex-col gap-4">
            <Headline animate as="h1" text={['Orbit', 'Design System']} />
          </div>
        </div>

        {/* Headline component */}
        <div className="flex flex-col gap-16 p-8 md:gap-32 md:p-16">
          <div className="flex flex-col gap-2">
            <span className="dark:text-polar-500 text-sm text-neutral-400">
              Headline
            </span>
            <div className="dark:border-polar-800 border-t border-neutral-200" />
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-16">
            <div className="flex flex-col gap-2">
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                h1
              </span>
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                text-5xl → text-8xl
              </span>
            </div>
            <div className="col-span-3">
              <Headline animate as="h1" text="The quick brown fox" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-16">
            <div className="flex flex-col gap-2">
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                h2
              </span>
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                text-4xl → text-5xl
              </span>
            </div>
            <div className="col-span-3">
              <Headline animate as="h2" text="The quick brown fox" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-16">
            <div className="flex flex-col gap-2">
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                h3
              </span>
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                text-3xl → text-5xl
              </span>
            </div>
            <div className="col-span-3">
              <Headline animate as="h3" text="The quick brown fox" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-16">
            <div className="flex flex-col gap-2">
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                h4
              </span>
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                text-2xl → text-3xl
              </span>
            </div>
            <div className="col-span-3">
              <Headline animate as="h4" text="The quick brown fox" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-16">
            <div className="flex flex-col gap-2">
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                h5
              </span>
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                text-xl → text-2xl
              </span>
            </div>
            <div className="col-span-3">
              <Headline animate as="h5" text="The quick brown fox" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-16">
            <div className="flex flex-col gap-2">
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                h6
              </span>
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                text-lg → text-xl
              </span>
            </div>
            <div className="col-span-3">
              <Headline animate as="h6" text="The quick brown fox" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-16">
            <div className="flex flex-col gap-2">
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                multiline
              </span>
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                staggered
              </span>
            </div>
            <div className="col-span-3">
              <Headline
                animate
                as="h2"
                text={['The quick', 'brown fox', 'jumps over']}
              />
            </div>
          </div>
        </div>

        {/* BarChart component */}
        <div className="flex flex-col gap-16 p-8 md:gap-32 md:p-16">
          <div className="flex flex-col gap-2">
            <span className="dark:text-polar-500 text-sm text-neutral-400">
              BarChart
            </span>
            <div className="dark:border-polar-800 border-t border-neutral-200" />
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-16">
            <div className="flex flex-col gap-2">
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                animated
              </span>
              <span className="dark:text-polar-500 text-sm text-neutral-500">
                3 bars
              </span>
            </div>
            <div className="col-span-3 h-96">
              <BarChart
                animated
                data={[
                  { label: 'Checkout Conversion', value: 0 },
                  { label: 'Retained Subscriptions', value: 59 },
                  { label: 'Customer Satisfaction', value: 81 },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-8 md:p-16">
          <span className="dark:text-polar-500 text-sm text-neutral-400">
            Orbit — Polar Software Inc
          </span>
          <span className="dark:text-polar-500 text-sm text-neutral-400">
            {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </div>
  )
}
