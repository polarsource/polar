'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

const BASE_PLAN_CENTS = 49_00
const FREE_TIER_TOKENS = 1_000_000
const PRICE_CENTS_PER_K = 0.2 // $0.002 per 1k tokens

const INITIAL_TOKENS = 8_420_000

function calcOverageCents(tokens: number): number {
  const billable = Math.max(0, tokens - FREE_TIER_TOKENS)
  return Math.round((billable / 1000) * PRICE_CENTS_PER_K)
}

function fmt(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

let _flashId = 0

export const CustomerCard = () => {
  const tokensRef = useRef(INITIAL_TOKENS)
  const overageRef = useRef(calcOverageCents(INITIAL_TOKENS))
  const [tokens, setTokens] = useState(INITIAL_TOKENS)
  const [overageCents, setOverageCents] = useState(overageRef.current)
  const [flash, setFlash] = useState<{ id: number; cents: number } | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      const added = Math.floor(Math.random() * 100_000) + 50_000
      tokensRef.current += added

      const newOverage = calcOverageCents(tokensRef.current)
      const delta = newOverage - overageRef.current
      overageRef.current = newOverage

      setTokens(tokensRef.current)
      setOverageCents(newOverage)

      if (delta > 0) {
        const id = ++_flashId
        setFlash({ id, cents: delta })
        setTimeout(
          () => setFlash((prev) => (prev?.id === id ? null : prev)),
          1800,
        )
      }
    }, 750)
    return () => clearInterval(interval)
  }, [])

  const totalCents = BASE_PLAN_CENTS + overageCents

  return (
    <motion.div
      className="relative flex flex-1 flex-col"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 1.2, delay: 0.4 }}
      viewport={{ once: true }}
    >
      <div className="dark:border-polar-700 flex h-full flex-col rounded-2xl border border-gray-200">
        {/* Header */}
        <div className="dark:border-polar-800 flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-x-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 font-mono text-[10px] font-medium text-white">
              U
            </div>
            <span className="font-mono text-sm">user_7f2a9b</span>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-xs font-medium text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            Pro
          </span>
        </div>

        {/* Line items */}
        <div className="flex flex-1 flex-col px-4 py-4">
          <LineItem label="Base subscription" value={fmt(BASE_PLAN_CENTS)} />
          <LineItem
            label={`Token overages (${(tokens / 1_000_000).toFixed(1)}M)`}
            value={fmt(overageCents)}
            animKey={overageCents}
          />
          <div className="dark:border-polar-800 my-3 border-t border-dashed border-gray-100" />
          <LineItem
            label="Total this period"
            value={fmt(totalCents)}
            bold
            animKey={totalCents}
          />
        </div>

        {/* Footer */}
        <div className="dark:border-polar-800 flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
            Next invoice Apr 1, 2026
          </span>
          <AnimatePresence mode="popLayout">
            {flash && (
              <motion.span
                key={flash.id}
                className="font-mono text-xs text-emerald-500"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                +{fmt(flash.cents)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

const LineItem = ({
  label,
  value,
  bold,
  animKey,
}: {
  label: string
  value: string
  bold?: boolean
  animKey?: number
}) => {
  const labelCls = bold
    ? 'font-mono text-sm font-medium'
    : 'dark:text-polar-500 font-mono text-sm text-gray-500'
  const valueCls = bold
    ? 'font-mono text-sm font-medium tabular-nums'
    : 'dark:text-polar-500 font-mono text-sm text-gray-600 tabular-nums'

  return (
    <div className="flex items-center justify-between py-1">
      <span className={labelCls}>{label}</span>
      {animKey !== undefined ? (
        <motion.span
          key={animKey}
          className={valueCls}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {value}
        </motion.span>
      ) : (
        <span className={valueCls}>{value}</span>
      )}
    </div>
  )
}
