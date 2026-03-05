'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

// ── Event definitions ──────────────────────────────────────────────────────────
const EVENT_DEFS = [
  {
    tag: 'API_CALL',
    color: 'text-blue-500 dark:text-blue-400',
    pill: 'bg-blue-50 dark:bg-blue-950/60',
    valueRange: [80, 420] as [number, number],
    unit: 'ms',
  },
  {
    tag: 'TOKENS',
    color: 'text-emerald-500 dark:text-emerald-400',
    pill: 'bg-emerald-50 dark:bg-emerald-950/60',
    valueRange: [512, 16384] as [number, number],
    unit: 'tokens',
  },
  {
    tag: 'INFERENCE',
    color: 'text-indigo-500 dark:text-indigo-400',
    pill: 'bg-indigo-50 dark:bg-indigo-950/60',
    valueRange: [1024, 8192] as [number, number],
    unit: 'tokens',
  },
] as const

const ORG_IDS = [
  'user_7f2a9b',
  'user_3c1e8d',
  'user_a4b5c6',
  'user_9d0e1f',
  'user_2b3c4d',
  'user_e5f6a7',
]

let _uid = 1000

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function nextEvent() {
  const def = EVENT_DEFS[rand(0, EVENT_DEFS.length - 1)]
  const org = ORG_IDS[rand(0, ORG_IDS.length - 1)]
  const value = rand(def.valueRange[0], def.valueRange[1])
  return { id: _uid++, def, org, value }
}

function initBars() {
  return Array.from({ length: 64 }, () => Math.random() * 0.55 + 0.08)
}

// ── Component ─────────────────────────────────────────────────────────────────
export const EventStream = () => {
  const [events, setEvents] = useState(() =>
    Array.from({ length: 5 }, nextEvent),
  )
  const [bars, setBars] = useState(initBars)
  const totalRef = useRef(38_471)
  const [total, setTotal] = useState(38_471)

  useEffect(() => {
    const interval = setInterval(() => {
      setEvents((prev) => [nextEvent(), ...prev.slice(0, 4)])
      setBars((prev) => [...prev.slice(1), Math.random() * 0.65 + 0.12])
      totalRef.current += rand(4, 18)
      setTotal(totalRef.current)
    }, 750)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      className="relative flex h-fit flex-1 flex-col"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 1.2, delay: 0.2 }}
      viewport={{ once: true }}
    >
      <div className="dark:border-polar-700 flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200">
        {/* Header */}
        <div className="dark:border-polar-800 flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-x-3">
            <motion.div
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <span className="font-mono text-sm">Live Events</span>
          </div>
          <span className="dark:text-polar-500 font-mono text-xs text-gray-500 tabular-nums">
            {total.toLocaleString()} ingested
          </span>
        </div>

        {/* Event log */}
        <div
          className="flex flex-col gap-y-2 overflow-auto p-2"
          style={{ perspective: 600, perspectiveOrigin: 'center top' }}
        >
          {events.map((e) => (
            <motion.div
              key={e.id}
              layout="position"
              initial={{ opacity: 0, scale: 0.9, z: -40 }}
              animate={{ opacity: 1, scale: 1, z: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex flex-row items-center justify-between gap-x-4"
            >
              <div className="flex flex-row items-center gap-x-6">
                {/* Tag */}
                <div className="w-16">
                  <span
                    className={`text-xxs w-fit shrink-0 rounded px-1 py-px font-mono font-medium tracking-wider ${e.def.color} ${e.def.pill}`}
                  >
                    {e.def.tag}
                  </span>
                </div>
                {/* Org */}
                <span className="dark:text-polar-500 min-w-0 flex-1 truncate font-mono text-xs text-gray-500">
                  {e.org}
                </span>
              </div>
              {/* Value */}
              <span className="dark:text-polar-500 text-xxs shrink-0 font-mono font-medium text-gray-600 tabular-nums">
                {e.value.toLocaleString()}{' '}
                <span className="dark:text-polar-500 text-gray-500">
                  {e.def.unit}
                </span>
              </span>
            </motion.div>
          ))}
        </div>

        {/* Sparkline footer */}
        <div className="dark:border-polar-800 border-t border-gray-100 px-4 pt-3 pb-4">
          <span className="dark:text-polar-500 mb-2 block font-mono text-xs tracking-widest text-gray-500 uppercase">
            Ingestion rate
          </span>
          <div className="flex h-10 items-end gap-x-2">
            {bars.map((h, i) => (
              <motion.div
                key={i}
                className="flex-1 bg-black dark:bg-white"
                animate={{ scaleY: h }}
                style={{ originY: 1, height: '100%' }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
