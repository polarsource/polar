'use client'

import { useEffect, useRef, useState } from 'react'
import { SegmentedBar } from '../SegmentedBar'

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
  const inTier3 = tokens > TIER2_END

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="dark:border-polar-700 flex h-full flex-col rounded-2xl border border-gray-200">
        {/* Header */}
        <div className="dark:border-polar-800 flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-x-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 font-mono text-[10px] font-medium text-white">
              U
            </div>
            <span className="font-mono text-sm">user_123</span>
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
            <span className="font-mono text-xs tabular-nums">
              {(tokens / 1_000_000).toFixed(1)}M{' '}
              <span className="dark:text-polar-500 text-gray-500">
                / {inTier3 ? '∞' : '10M'}
              </span>
            </span>
          </div>

          {/* Segmented progress */}
          <SegmentedBar progress={tierProgress} />

          <div className="flex items-center justify-between">
            <span className="dark:text-polar-500 font-mono text-xs text-gray-500">
              {inTier3 ? '$0.001' : '$0.002'} / 1k tokens
            </span>
          </div>
        </div>

        {/* Line items */}
        <div className="flex flex-col px-4 py-3">
          <LineItem label="Pro Subscription" value={fmt(BASE_PLAN_CENTS)} />
          <LineItem label="Token Overages" value={fmt(overageCents)} />
          <div className="dark:border-polar-700 my-2 border-t border-dashed border-gray-100" />
          <LineItem label="Total this period" value={fmt(totalCents)} bold />
        </div>
      </div>
    </div>
  )
}

const LineItem = ({
  label,
  value,
  bold,
}: {
  label: string
  value: string
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
      <span className={valueCls}>{value}</span>
    </div>
  )
}
