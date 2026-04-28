'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Dumbbell } from '../Dumbbell'
import { CycleArrow } from '../CycleArrow'
import { LinkedRings } from '../LinkedRings'
import { CreditArc } from '../CreditArc'
import { RadialSpinner } from '../RadialSpinner'
import { GaugeSweep } from '../GaugeSweep'
import { WaveBars } from '../WaveBars'
import { VectorField } from '../VectorField'
import { LandingSection } from './LandingSection'
import { SectionHeading } from './SectionHeading'

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
    Graphic: RadialSpinner,
  },
  {
    title: 'Metering',
    desc: 'Define meters with filters and aggregation to compute usage in real time.',
    Graphic: GaugeSweep,
  },
  {
    title: 'Webhooks',
    desc: 'Real-time event notifications with Standard Webhooks and signature validation.',
    Graphic: VectorField,
  },
  {
    title: 'Invoicing',
    desc: 'Automated invoices for subscriptions and usage charges, generated every cycle.',
    Graphic: WaveBars,
  },
]

export const LandingOffering = () => {
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
    <LandingSection className="max-w-none! py-32">
      <div className="mx-auto max-w-[1760px] px-4 pb-16 md:px-16">
        <SectionHeading>
          Everything you need.
          <br />
          Nothing you don&apos;t.
        </SectionHeading>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pr-16 pb-8 pl-[max(1rem,calc((100vw-1760px)/2+4rem))] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TILES.map((tile) => {
          const G = tile.Graphic
          return (
            <div
              key={tile.title}
              className="dark:bg-dark-900 flex w-[340px] shrink-0 flex-col bg-neutral-50 md:w-[520px]"
            >
              <div className="flex flex-col gap-3 p-12 pb-4">
                <span className="text-4xl text-neutral-900 dark:text-white">
                  {tile.title}
                </span>
                <span className="dark:text-dark-300 text-2xl text-neutral-500">
                  {tile.desc}
                </span>
              </div>
              <div className="mt-auto aspect-square w-full">
                <G />
              </div>
            </div>
          )
        })}
      </div>

      <div className="dark:bg-dark-800 mt-4 ml-[max(1rem,calc((100vw-1760px)/2+4rem))] h-px w-96 bg-neutral-200">
        <div
          className="h-full bg-neutral-900 dark:bg-white"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </LandingSection>
  )
}
