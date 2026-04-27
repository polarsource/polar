'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Dumbbell } from '../Dumbbell'
import { CycleArrow } from '../CycleArrow'
import { LinkedRings } from '../LinkedRings'
import { CreditArc } from '../CreditArc'

gsap.registerPlugin(ScrollTrigger)

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

export const LandingOffering = () => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const trigger = ScrollTrigger.create({
      trigger: wrapper,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const idx = Math.min(
          TILES.length - 1,
          Math.floor(self.progress * TILES.length),
        )
        setActiveIndex(idx)
      },
    })

    return () => trigger.kill()
  }, [])

  const ActiveGraphic = TILES[activeIndex].Graphic

  return (
    <div ref={wrapperRef} style={{ height: `${TILES.length * 100}vh` }}>
      <section className="sticky top-0 h-screen py-24">
        <div className="grid h-full grid-cols-1 gap-12 lg:grid-cols-2">
          <div className="dark:bg-dark-900 flex items-center justify-center bg-neutral-50 p-16">
            <div className="w-full max-w-xl">
              <ActiveGraphic key={activeIndex} />
            </div>
          </div>

          <div className="flex flex-col justify-center px-8 lg:px-16">
            <div className="flex flex-col gap-4">
              {TILES.map((tile, i) => (
                <>
                  <span
                    key={tile.title}
                    className={`block text-[clamp(2rem,4vw,6rem)] leading-[1.1] font-normal transition-all duration-500 ${
                      i === activeIndex
                        ? 'text-neutral-900 dark:text-white'
                        : 'dark:text-dark-700 text-neutral-200'
                    }`}
                  >
                    {tile.title}
                  </span>

                  {i === activeIndex && (
                    <div className="max-w-2xl py-2 md:py-6">
                      <p className="dark:text-dark-300 text-[clamp(2rem,4vw,3rem)] leading-snug text-neutral-500 transition-all duration-500">
                        {TILES[activeIndex].desc}
                      </p>
                    </div>
                  )}
                </>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
