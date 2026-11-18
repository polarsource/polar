import { useInView } from '@/hooks/useInView'
import { useEffect, useRef, useState } from 'react'

export type UsageEventName =
  | 'llm.completion'
  | 'tts.generate'
  | 'image.generate'

export interface UsageEvent {
  id: number
  name: UsageEventName
  /** What the event counts: tokens for a completion, characters for speech, images for an image. */
  quantity: number
  /** What the customer is charged for it. */
  revenue: number
  /** What it cost to serve: the model's inference. */
  cost: number
}

/** What the customer pays, per unit. */
const PRICES: Record<UsageEventName, number> = {
  'llm.completion': 1 / 1_000_000,
  'tts.generate': 15 / 1_000_000,
  'image.generate': 0.04,
}
/** What it costs to serve, per unit. */
const COSTS: Record<UsageEventName, number> = {
  'llm.completion': 0.6 / 1_000_000,
  'tts.generate': 6 / 1_000_000,
  'image.generate': 0.018,
}
const EVENT_RHYTHM: UsageEventName[] = [
  'llm.completion',
  'tts.generate',
  'llm.completion',
  'image.generate',
  'llm.completion',
]
const QUANTITIES: Record<UsageEventName, [number, number]> = {
  'llm.completion': [180_000, 1_200_000],
  'tts.generate': [8_000, 40_000],
  'image.generate': [4, 24],
}

export const VISIBLE_EVENTS = 3
export const PLAN_PRICE = 2_499
/** Where the cycle stands when the section comes into view: a large customer, three weeks in. */
const OPENING = { revenue: 18_432.17, cost: 7_104.62, tokens: 9_216_084_000 }
/** Each meter's reading at the same point in the cycle. */
const OPENING_UNITS: Record<UsageEventName, number> = {
  'llm.completion': 9_216_084_000,
  'tts.generate': 184_220_400,
  'image.generate': 41_806,
}
/** Points kept on the chart: enough for a line, few enough to read. */
export const CHART_POINTS = 32
/** The pace of the stream: a floor, and the spread above it. */
const PACE = [240, 80]

export const count = (value: number) => value.toLocaleString('en-US')
export const compact = (value: number) =>
  value.toLocaleString('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  })
export const dollars = (value: number, digits: number) =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
export const percent = (value: number) => `${Math.round(value * 100)}%`

/** Deterministic noise, so the stream looks alive without being random on every render. */
const noise = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

const makeEvent = (id: number): UsageEvent => {
  const name = EVENT_RHYTHM[id % EVENT_RHYTHM.length]
  const [low, high] = QUANTITIES[name]
  const quantity = Math.round(low + (high - low) * noise(id))
  return {
    id,
    name,
    quantity,
    revenue: quantity * PRICES[name],
    cost: quantity * COSTS[name],
  }
}

export interface MarginPoint {
  revenue: number
  cost: number
}

/**
 * A live stream of usage events, and the unit economics they add up to: revenue and cost per event, totals, and a
 * running margin series for the chart. Starts empty and fills in while the section is in view.
 */
export const useUsageStream = (visible = VISIBLE_EVENTS) => {
  // The stream runs only while the section is on screen. Ids persist across pauses, so resumed events never
  // collide with rows already on the ledger.
  const { ref, inView } = useInView()
  const nextId = useRef(0)
  const [events, setEvents] = useState<UsageEvent[]>([])
  const [totals, setTotals] = useState({
    ...OPENING,
    units: OPENING_UNITS,
    byName: {
      'llm.completion': 0,
      'tts.generate': 0,
      'image.generate': 0,
    } as Record<UsageEventName, number>,
  })
  const [series, setSeries] = useState<MarginPoint[]>([])

  useEffect(() => {
    if (!inView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // No animation: show a settled stream straight away.
      const settled = Array.from({ length: CHART_POINTS }, (_, i) =>
        makeEvent(i + 1),
      )
      const timer = window.setTimeout(() => {
        setEvents(settled.slice(-visible).reverse())
        setTotals(
          settled.reduce(
            (sum, e) => ({
              revenue: sum.revenue + e.revenue,
              cost: sum.cost + e.cost,
              tokens:
                sum.tokens + (e.name === 'llm.completion' ? e.quantity : 0),
              units: { ...sum.units, [e.name]: sum.units[e.name] + e.quantity },
              byName: {
                ...sum.byName,
                [e.name]: sum.byName[e.name] + e.revenue,
              },
            }),
            {
              ...OPENING,
              units: OPENING_UNITS,
              byName: {
                'llm.completion': 0,
                'tts.generate': 0,
                'image.generate': 0,
              },
            },
          ),
        )
        setSeries(settled.map((e) => ({ revenue: e.revenue, cost: e.cost })))
      }, 0)
      return () => clearTimeout(timer)
    }

    let timer = 0
    const next = () => {
      timer = window.setTimeout(
        () => {
          nextId.current += 1
          const event = makeEvent(nextId.current)
          setEvents((list) => [event, ...list].slice(0, visible))
          setTotals((sum) => ({
            revenue: sum.revenue + event.revenue,
            cost: sum.cost + event.cost,
            tokens:
              sum.tokens +
              (event.name === 'llm.completion' ? event.quantity : 0),
            units: {
              ...sum.units,
              [event.name]: sum.units[event.name] + event.quantity,
            },
            byName: {
              ...sum.byName,
              [event.name]: sum.byName[event.name] + event.revenue,
            },
          }))
          setSeries((points) =>
            [...points, { revenue: event.revenue, cost: event.cost }].slice(
              -CHART_POINTS,
            ),
          )
          next()
        },
        PACE[0] + noise(nextId.current + 0.25) * PACE[1],
      )
    }
    const start = window.setTimeout(next, 0)
    return () => {
      clearTimeout(start)
      clearTimeout(timer)
    }
  }, [inView, visible])

  return {
    ref,
    events,
    totals,
    series,
    margin: totals.revenue > 0 ? 1 - totals.cost / totals.revenue : 0,
  }
}
