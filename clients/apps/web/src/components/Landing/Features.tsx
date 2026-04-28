'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Dumbbell } from './graphics/Dumbbell'
import { CycleArrow } from './graphics/CycleArrow'
import { LinkedRings } from './graphics/LinkedRings'
import { CreditArc } from './graphics/CreditArc'
import { WaveBars } from './graphics/WaveBars'
import { VectorField } from './graphics/VectorField'

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
    desc: 'Prepay and draw down over time — like a wallet for your API.',
    Graphic: CreditArc,
  },
  {
    title: 'Analytics',
    desc: 'Revenue, MRR, churn, and cost insights — no custom tracking needed.',
    Graphic: WaveBars,
  },
  {
    title: 'Webhooks',
    desc: 'Real-time event notifications with Standard Webhooks and signature validation.',
    Graphic: VectorField,
  },
]

export const Features = () => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setProgress(max > 0 ? el.scrollLeft / max : 0)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [onScroll])

  return (
    <div className="flex max-w-none! flex-col gap-y-12 py-32 md:gap-y-24">
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="font-display px-4 text-4xl leading-snug md:px-0 md:text-7xl">
          All billing primitives you need.
          <br />
          In a single API.
        </h1>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pr-16 pl-[max(1rem,calc((100vw-1280px)/2-1rem))] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TILES.map((tile) => {
          const G = tile.Graphic
          return (
            <div
              key={tile.title}
              className="dark:bg-dark-900 flex w-[340px] shrink-0 flex-col bg-neutral-50 md:w-[420px]"
            >
              <div className="flex flex-col gap-4 p-8">
                <span className="font-display text-3xl text-neutral-900 dark:text-white">
                  {tile.title}
                </span>
                <span className="dark:text-dark-300 text-xl text-neutral-500">
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

      <div className="dark:bg-dark-800 mx-auto h-px w-full max-w-7xl bg-neutral-200">
        <div
          className="h-full bg-neutral-900 dark:bg-white"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}
