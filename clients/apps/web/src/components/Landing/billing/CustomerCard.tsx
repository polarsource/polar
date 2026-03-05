'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

const BASE_PLAN_CENTS = 49_00
const TIER1_END = 1_000_000
const TIER2_END = 10_000_000

const INITIAL_TOKENS = 6_100_000

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

export const CustomerCard = () => {
  const tokensRef = useRef(INITIAL_TOKENS)
  const overageRef = useRef(calcOverageCents(INITIAL_TOKENS))
  const [tokens, setTokens] = useState(INITIAL_TOKENS)
  const [overageCents, setOverageCents] = useState(overageRef.current)

  useEffect(() => {
    const interval = setInterval(() => {
      const added = Math.floor(Math.random() * 100_000) + 50_000
      tokensRef.current += added

      const newOverage = calcOverageCents(tokensRef.current)
      overageRef.current = newOverage

      setTokens(tokensRef.current)
      setOverageCents(newOverage)
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
        <div className="dark:border-polar-800 flex flex-col gap-y-4 border-b border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs">
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

          {/* Segmented progress */}
          <SegmentedBar progress={tierProgress} />

          <div className="flex items-center justify-between">
            <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
              {inTier3 ? '$0.001' : '$0.002'} / 1k tokens
            </span>
            {!inTier3 && (
              <motion.span
                key={Math.floor(remainingM * 10)}
                className="dark:text-polar-500 font-mono text-xs text-gray-500 tabular-nums"
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
          <LineItem label="Pro Subscription" value={fmt(BASE_PLAN_CENTS)} />
          <LineItem
            label="Token Overages"
            value={fmt(overageCents)}
            animKey={overageCents}
          />
          <div className="dark:border-polar-700 my-2 border-t border-dashed border-gray-100" />
          <LineItem
            label="Total this period"
            value={fmt(totalCents)}
            animKey={totalCents}
            bold
          />
        </div>
      </div>
    </motion.div>
  )
}

const SEGMENTS = 64

const SegmentedBar = ({ progress }: { progress: number }) => {
  const filled = Math.round(progress * SEGMENTS)

  return (
    <div className="flex gap-x-2">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 transition-colors duration-500 ${i < filled ? 'bg-black dark:bg-white' : 'dark:bg-polar-700 bg-gray-200'}`}
        />
      ))}
    </div>
  )
}

const LineItem = ({
  label,
  value,
  animKey,
  bold,
}: {
  label: string
  value: string
  animKey?: number
  bold?: boolean
}) => {
  const labelCls = bold
    ? 'font-mono text-sm'
    : 'dark:text-polar-500 font-mono text-sm text-gray-500'
  const valueCls = bold
    ? 'font-mono tabular-nums text-sm'
    : 'dark:text-polar-500 font-mono text-sm text-gray-500 tabular-nums'

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
