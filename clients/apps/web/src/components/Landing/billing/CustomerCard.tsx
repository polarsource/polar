'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

const BASE_PLAN_CENTS = 49_00
const TIER1_END = 1_000_000
const TIER2_END = 10_000_000

const INITIAL_TOKENS = 8_100_000

function calcOverageCents(tokens: number): number {
  const tier2 = Math.min(Math.max(0, tokens - TIER1_END), TIER2_END - TIER1_END)
  const tier3 = Math.max(0, tokens - TIER2_END)
  return Math.round((tier2 / 1000) * 0.2 + (tier3 / 1000) * 0.1)
}

function fmt(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

let _chargeId = 0

export const CustomerCard = () => {
  const tokensRef = useRef(INITIAL_TOKENS)
  const overageRef = useRef(calcOverageCents(INITIAL_TOKENS))
  const [tokens, setTokens] = useState(INITIAL_TOKENS)
  const [overageCents, setOverageCents] = useState(overageRef.current)
  const [charges, setCharges] = useState<Array<{ id: number; cents: number }>>(
    [],
  )

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
        const id = ++_chargeId
        setCharges((prev) => [{ id, cents: delta }, ...prev.slice(0, 2)])
      }
    }, 750)
    return () => clearInterval(interval)
  }, [])

  const totalCents = BASE_PLAN_CENTS + overageCents
  const tierProgress = Math.min(
    1,
    (tokens - TIER1_END) / (TIER2_END - TIER1_END),
  )
  const remainingM = Math.max(0, TIER2_END - tokens) / 1_000_000
  const inTier3 = tokens > TIER2_END

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

        {/* Tier usage */}
        <div className="dark:border-polar-800 border-b border-gray-100 px-4 py-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
              {inTier3 ? 'Tier 3 · Token Usage' : 'Tier 2 · Token Usage'}
            </span>
            <motion.span
              key={Math.floor(tokens / 100_000)}
              className="font-mono text-xs tabular-nums"
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {(tokens / 1_000_000).toFixed(1)}M{' '}
              <span className="dark:text-polar-500 text-gray-500">
                / {inTier3 ? '∞' : '10M'}
              </span>
            </motion.span>
          </div>

          {/* Progress bar */}
          <div className="dark:bg-polar-800 relative h-1.5 overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${inTier3 ? 'bg-amber-500' : 'bg-blue-500'}`}
              animate={{ width: inTier3 ? '100%' : `${tierProgress * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between">
            <span className="dark:text-polar-400 font-mono text-[10px] text-gray-400">
              {inTier3 ? '$0.001' : '$0.002'} / 1k tokens
            </span>
            {!inTier3 && (
              <motion.span
                key={Math.floor(remainingM * 10)}
                className="dark:text-polar-400 font-mono text-[10px] text-gray-400 tabular-nums"
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {remainingM.toFixed(1)}M to Tier 3
              </motion.span>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="flex flex-col px-4 py-3">
          <LineItem label="Base subscription" value={fmt(BASE_PLAN_CENTS)} />
          <LineItem
            label="Token overages"
            value={fmt(overageCents)}
            animKey={overageCents}
          />
          <div className="dark:border-polar-800 my-2 border-t border-dashed border-gray-100" />
          <LineItem
            label="Total this period"
            value={fmt(totalCents)}
            bold
            animKey={totalCents}
          />
        </div>

        {/* Footer */}
        <div className="dark:border-polar-800 border-t border-gray-100 px-4 py-3">
          <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
            Next invoice Apr 1, 2026
          </span>
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
