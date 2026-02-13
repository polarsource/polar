'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Section } from './Section'
import CheckoutFlow from './animated/CheckoutFlow'
import EventStream from './animated/EventStream'
import SubscriptionCycle from './animated/SubscriptionCycle'

const INTERVAL = 8000

const categories = [
  {
    title: 'Usage-based Billing',
    description:
      'Ingest events from your application in real-time. Meter API calls, tokens, compute minutes, or any custom metric — and bill your customers with precision.',
    bullets: [
      'Real-time event ingestion',
      'Flexible metering & aggregation',
      'Automatic invoice reconciliation',
    ],
  },
  {
    title: 'Subscriptions',
    description:
      'Offer recurring plans with flexible billing cycles. Manage upgrades, downgrades, trials, and entitlements — all from a single API.',
    bullets: [
      'Flexible billing cycles',
      'Plan management & upgrades',
      'Trial periods & entitlements',
    ],
  },
  {
    title: 'Digital Products',
    description:
      'Sell one-time digital products like downloads, license keys, and access passes. Deliver instantly with no infrastructure overhead.',
    bullets: [
      'One-time purchases',
      'Instant digital delivery',
      'License key management',
    ],
  },
]

type UsageProps = {
  className?: string
}

const Usage = ({ className }: UsageProps) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    startTimeRef.current = Date.now()
    setProgress(0)

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const p = Math.min(1, elapsed / INTERVAL)
      setProgress(p)

      if (p >= 1) {
        if (timerRef.current) clearInterval(timerRef.current)
        setActiveIndex((prev) => (prev + 1) % categories.length)
      }
    }, 16)
  }, [])

  useEffect(() => {
    startTimer()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [activeIndex, startTimer])

  const handleClick = (index: number) => {
    if (index === activeIndex) return
    setActiveIndex(index)
  }

  const animations = [
    <EventStream key="usage" />,
    <SubscriptionCycle key="subscriptions" />,
    <CheckoutFlow key="digital-products" />,
  ]

  return (
    <Section className={twMerge('flex flex-col gap-y-12', className)}>
      <div className="dark:bg-polar-900 flex flex-col gap-6 rounded-4xl bg-gray-50 p-2 md:flex-row md:gap-12">
        <div className="flex flex-col gap-y-12 p-8 md:p-12 xl:flex-1">
          <span className="dark:text-polar-500 text-gray-500">
            Modern Billing Primitives
          </span>

          <div className="flex flex-col gap-y-8">
            {categories.map((category, index) => {
              const isActive = index === activeIndex
              return (
                <button
                  key={category.title}
                  type="button"
                  onClick={() => handleClick(index)}
                  className={twMerge(
                    'group relative flex cursor-pointer items-start gap-x-8 rounded-2xl text-left transition-colors',
                  )}
                >
                  {/* Progress bar */}
                  <div className="relative flex h-full w-0.5 shrink-0 self-stretch overflow-hidden rounded-full">
                    <div
                      className={twMerge(
                        'absolute inset-x-0 top-0 w-full rounded-full transition-colors',
                        isActive
                          ? 'bg-black dark:bg-white'
                          : 'dark:bg-polar-600 bg-gray-200',
                      )}
                      style={{
                        height: isActive ? `${progress * 100}%` : '0%',
                      }}
                    />
                    <div
                      className={twMerge(
                        'h-full w-full rounded-full',
                        isActive
                          ? 'dark:bg-polar-600 bg-gray-200'
                          : 'dark:bg-polar-700 bg-gray-100',
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-y-2">
                    <h3
                      className={twMerge(
                        'text-base transition-colors md:text-2xl',
                        isActive
                          ? 'text-black dark:text-white'
                          : 'dark:text-polar-500 text-gray-500',
                      )}
                    >
                      {category.title}
                    </h3>

                    <div
                      className={twMerge(
                        'grid transition-all duration-300',
                        isActive
                          ? 'grid-rows-[1fr] opacity-100'
                          : 'grid-rows-[0fr] opacity-0',
                      )}
                    >
                      <div className="flex flex-col gap-y-3 overflow-hidden">
                        <p className="dark:text-polar-500 leading-relaxed text-gray-500">
                          {category.description}
                        </p>
                        <ul className="dark:text-polar-500 flex flex-col gap-y-1.5 text-gray-600">
                          {category.bullets.map((bullet) => (
                            <li
                              key={bullet}
                              className="flex items-center gap-x-2"
                            >
                              <span className="dark:bg-polar-500 inline-block h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="dark:bg-polar-950 flex min-h-[300px] items-center justify-center overflow-hidden rounded-3xl bg-white p-12 md:min-h-0 md:p-16 xl:flex-1">
          {animations[activeIndex]}
        </div>
      </div>
    </Section>
  )
}

export default Usage
