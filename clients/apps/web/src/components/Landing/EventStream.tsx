'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

// ── Event definitions ──────────────────────────────────────────────────────────
const EVENT_DEFS = [
  {
    tag: 'API_CALL',
    color: 'text-blue-500 dark:text-blue-400',
    pill: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/60',
    valueRange: [80, 420] as [number, number],
    unit: 'ms',
  },
  {
    tag: 'TOKENS',
    color: 'text-violet-500 dark:text-violet-400',
    pill: 'bg-violet-50 dark:bg-violet-950/60 border-violet-200 dark:border-violet-800/60',
    valueRange: [512, 16384] as [number, number],
    unit: 'tok',
  },
  {
    tag: 'INFERENCE',
    color: 'text-indigo-500 dark:text-indigo-400',
    pill: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/60',
    valueRange: [1024, 8192] as [number, number],
    unit: 'tok',
  },
  {
    tag: 'WEBHOOK',
    color: 'text-emerald-500 dark:text-emerald-400',
    pill: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60',
    valueRange: [1, 1] as [number, number],
    unit: 'evt',
  },
  {
    tag: 'QUOTA',
    color: 'text-amber-500 dark:text-amber-400',
    pill: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60',
    valueRange: [60, 99] as [number, number],
    unit: '%',
  },
] as const

const ORG_IDS = [
  'org_7f2a9b',
  'org_3c1e8d',
  'org_a4b5c6',
  'org_9d0e1f',
  'org_2b3c4d',
  'org_e5f6a7',
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
    Array.from({ length: 8 }, nextEvent),
  )
  const [bars, setBars] = useState(initBars)
  const totalRef = useRef(38_471)
  const [total, setTotal] = useState(38_471)

  useEffect(() => {
    const interval = setInterval(() => {
      setEvents((prev) => [nextEvent(), ...prev.slice(0, 7)])
      setBars((prev) => [...prev.slice(1), Math.random() * 0.65 + 0.12])
      totalRef.current += rand(4, 18)
      setTotal(totalRef.current)
    }, 750)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      className="relative flex flex-1 flex-col"
      style={{ minHeight: 460 }}
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
          <motion.span
            key={total}
            className="dark:text-polar-500 font-mono text-sm text-gray-500 tabular-nums"
            initial={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {total.toLocaleString()} ingested
          </motion.span>
        </div>

        {/* Event log */}
        <div className="flex flex-1 flex-col gap-y-1 overflow-hidden p-2">
          <AnimatePresence initial={false} mode="popLayout">
            {events.map((e) => (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                className="dark:border-polar-800 flex items-center gap-x-2.5 rounded-lg border border-gray-100 px-3 py-2"
              >
                {/* Tag */}
                <span
                  className={`shrink-0 rounded border px-1.5 py-px font-mono text-[9px] font-medium tracking-wider ${e.def.color} ${e.def.pill}`}
                >
                  {e.def.tag}
                </span>
                {/* Org */}
                <span className="dark:text-polar-500 min-w-0 flex-1 truncate font-mono text-[10px] text-gray-500">
                  {e.org}
                </span>
                {/* Value */}
                <span className="dark:text-polar-500 shrink-0 font-mono text-[10px] font-medium text-gray-600 tabular-nums">
                  {e.value.toLocaleString()}{' '}
                  <span className="dark:text-polar-500 text-gray-500">
                    {e.def.unit}
                  </span>
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
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
