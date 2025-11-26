import { UpsellKey, useUpsell } from '@/hooks/upsell'
import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import AvatarWrapper from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { motion, useMotionValue, useMotionValueEvent } from 'framer-motion'
import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { EventCostBadge } from '../Events/EventCostBadge'

export const EventsUpsell = () => {
  const { isUpsellDisabled, disableUpsell } = useUpsell(UpsellKey.COST_INSIGHTS)

  const [eventOffset, setEventOffset] = useState(() => 7)
  const y = useMotionValue(0)
  const previousClosestIndexRef = useRef<number | null>(null)

  const keyframes = useMemo(
    () =>
      Array.from({ length: mockedEvents.length + 1 }, (_, i) => -750 + i * 50),
    [],
  )

  useMotionValueEvent(y, 'change', (latest) => {
    // Find the closest keyframe to the current position
    let closestIndex = 0
    let closestDistance = Math.abs(latest - keyframes[0])

    for (let i = 1; i < keyframes.length; i++) {
      const distance = Math.abs(latest - keyframes[i])
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = i
      }
    }

    // Only update if we've moved to a different keyframe
    if (previousClosestIndexRef.current !== closestIndex) {
      previousClosestIndexRef.current = closestIndex
      // Update offset based on the current keyframe
      // Add 1 because we want to include events from the current keyframe onwards
      const newOffset = Math.min(closestIndex, mockedEvents.length)
      setEventOffset(newOffset)
    }
  })

  const profit = useMemo(() => {
    const events = mockedEvents.slice(-eventOffset)

    const profit = events.reduce((acc, event) => {
      return (
        acc +
        (event.cost?.amount ? -event.cost.amount : 0) +
        (event.revenue?.amount ? event.revenue.amount : 0)
      )
    }, 0)

    return profit
  }, [eventOffset])

  if (isUpsellDisabled) {
    return null
  }

  return (
    <div className="dark:bg-polar-800 relative flex w-full flex-col gap-y-6 overflow-hidden rounded-4xl bg-gray-50 p-2 xl:flex-row">
      <div className="flex w-full flex-1 flex-col gap-y-8 p-6 md:p-12">
        <span className="bg-blue w-fit rounded-full px-3 py-1 text-xs font-medium text-white">
          Now in Beta
        </span>
        <h3 className="text-3xl leading-tight! text-balance md:text-4xl">
          A realtime view of your revenue & costs
        </h3>
        <p className="dark:text-polar-500 text-lg text-gray-500">
          Track revenue, costs & profits in realtime. Understand your business
          performance like never before.
        </p>
        <div className="flex flex-row items-center gap-x-4">
          <Link
            href="/docs/features/cost-insights/introduction"
            target="_blank"
          >
            <Button
              variant="secondary"
              className="rounded-full"
              wrapperClassNames="flex flex-row items-center gap-x-2"
            >
              <span>Read the docs</span>
              <ArrowOutwardOutlined fontSize="inherit" />
            </Button>
          </Link>
          <Button
            variant="secondary"
            className="rounded-full"
            onClick={disableUpsell}
          >
            Dismiss
          </Button>
        </div>
      </div>
      <div className="dark:bg-polar-900 flex w-full flex-1 flex-col gap-y-4 rounded-3xl bg-white p-8">
        <div className="flex flex-row items-center justify-between gap-x-4">
          <h3>Activity</h3>
          <div className="flex flex-row items-center gap-x-4">
            <div className="flex flex-row items-center gap-x-4 font-mono text-xs">
              <span>Profit</span>
              <span className="dark:text-polar-500 text-gray-500">
                {formatCurrencyAndAmount(profit, 'usd', 2, 'compact', 12)}
              </span>
            </div>
          </div>
        </div>
        <div
          className="relative h-[356px] overflow-hidden"
          style={{
            maskImage:
              'linear-gradient(to bottom, transparent 0rem, black .5rem, black calc(100% - .5rem), transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0rem, black .5rem, black calc(100% - .5rem), transparent 100%)',
          }}
        >
          <motion.div
            className="flex w-full flex-col gap-y-2 py-2"
            style={{ y }}
            initial={{
              y: '-100%',
            }}
            animate={{
              y: keyframes,
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              repeatType: 'loop',
              ease: [0.83, 0, 0.17, 1],
            }}
            whileInView="animate"
          >
            {mockedEvents.map((event, idx) => (
              <motion.div
                key={idx}
                className="dark:bg-polar-800 dark:border-polar-700 flex w-full flex-row items-center justify-between gap-x-8 rounded-md border border-gray-100 bg-gray-100 p-2 px-4 font-mono text-xs"
              >
                <div className="flex w-fit flex-row items-center gap-x-8">
                  <h3 className="w-full truncate xl:w-36">{event.name}</h3>
                  <p className="dark:text-polar-500 hidden w-28 text-xs text-gray-500 xl:flex">
                    {event.timestamp.toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex w-fit flex-row items-center justify-end gap-x-4 md:w-32">
                  {'cost' in event && event.cost && (
                    <EventCostBadge
                      cost={event.cost.amount}
                      currency={event.cost.currency}
                      type="cost"
                      nonCostEvent={event.cost.amount === 0}
                    />
                  )}
                  {'revenue' in event && event.revenue && (
                    <EventCostBadge
                      cost={event.revenue.amount}
                      currency={event.revenue.currency}
                      type="revenue"
                      nonCostEvent={event.revenue.amount === 0}
                    />
                  )}
                  <AvatarWrapper
                    className="hidden md:block"
                    name={event.name}
                    avatar_url="/assets/landing/testamonials/emil.jpg"
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

const mockedEvents = [
  {
    id: 1,
    name: 'OpenAI Inference',
    timestamp: new Date('2025-10-30T00:00:14Z'),
    cost: {
      amount: 24,
      currency: 'usd',
    },
  },
  {
    id: 2,
    name: 'Anthropic Inference',
    timestamp: new Date('2025-10-30T00:00:13Z'),
    cost: {
      amount: 15,
      currency: 'usd',
    },
  },
  {
    id: 3,
    name: 'Order Paid',
    timestamp: new Date('2025-10-30T00:00:12Z'),
    revenue: {
      amount: 2500,
      currency: 'usd',
    },
  },
  {
    id: 4,
    name: 'Storage Upload',
    timestamp: new Date('2025-10-30T00:00:11Z'),
    cost: {
      amount: 33,
      currency: 'usd',
    },
  },
  {
    id: 5,
    name: 'Anthropic Inference',
    timestamp: new Date('2025-10-30T00:00:10Z'),
    cost: {
      amount: 28,
      currency: 'usd',
    },
  },
  {
    id: 6,
    name: 'OpenAI Inference',
    timestamp: new Date('2025-10-30T00:00:09Z'),
    cost: {
      amount: 24,
      currency: 'usd',
    },
  },
  {
    id: 7,
    name: 'Anthropic Inference',
    timestamp: new Date('2025-10-30T00:00:08Z'),
    cost: {
      amount: 15,
      currency: 'usd',
    },
  },
  {
    id: 8,
    name: 'Subscription Upgrade',
    timestamp: new Date('2025-10-30T00:00:07Z'),
    revenue: {
      amount: 1000,
      currency: 'usd',
    },
  },
  {
    id: 9,
    name: 'Storage Upload',
    timestamp: new Date('2025-10-30T00:00:06Z'),
    cost: {
      amount: 33,
      currency: 'usd',
    },
  },
  {
    id: 10,
    name: 'Anthropic Inference',
    timestamp: new Date('2025-10-30T00:00:05Z'),
    cost: {
      amount: 21,
      currency: 'usd',
    },
  },
  {
    id: 11,
    name: 'OpenAI Inference',
    timestamp: new Date('2025-10-30T00:00:04Z'),
    cost: {
      amount: 29,
      currency: 'usd',
    },
  },
  {
    id: 12,
    name: 'Anthropic Inference',
    timestamp: new Date('2025-10-30T00:00:03Z'),
    cost: {
      amount: 52,
      currency: 'usd',
    },
  },
  {
    id: 13,
    name: 'OpenAI Inference',
    timestamp: new Date('2025-10-30T00:00:02Z'),
    cost: {
      amount: 78,
      currency: 'usd',
    },
  },
  {
    id: 14,
    name: 'Trial Started',
    timestamp: new Date('2025-10-30T00:00:01Z'),
    cost: {
      amount: 0,
      currency: 'usd',
    },
  },
  {
    id: 17,
    name: 'Customer Acquired',
    timestamp: new Date('2025-10-30T00:00:00Z'),
    cost: {
      amount: 5000,
      currency: 'usd',
    },
  },
]
