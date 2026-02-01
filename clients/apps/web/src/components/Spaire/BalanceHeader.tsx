'use client'

import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

interface BalanceHeaderProps {
  totalBalance: number
  currency?: string
  percentChange?: number
  inflow?: number
  outflow?: number
  className?: string
}

const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100)
}

const formatCompact = (amount: number, currency = 'USD') => {
  const value = amount / 100
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`
  }
  return formatCurrency(amount, currency)
}

export default function BalanceHeader({
  totalBalance,
  currency = 'USD',
  percentChange = 12.5,
  inflow = 8750000,
  outflow = 3125000,
  className,
}: BalanceHeaderProps) {
  const isPositive = percentChange >= 0

  return (
    <div className={twMerge('flex flex-col gap-8', className)}>
      {/* Main Balance */}
      <div className="flex flex-col gap-3">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-sm font-medium tracking-wide text-white/40"
        >
          Total Balance
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-6xl font-light tracking-tight text-white md:text-7xl"
        >
          {formatCurrency(totalBalance, currency)}
        </motion.h1>

        {/* Trend indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex items-center gap-3"
        >
          <div
            className={twMerge(
              'flex items-center gap-1.5 rounded-full px-3 py-1',
              isPositive
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400',
            )}
          >
            <TrendingUp
              className={twMerge('h-4 w-4', !isPositive && 'rotate-180')}
            />
            <span className="text-sm">
              {isPositive ? '+' : ''}
              {percentChange.toFixed(1)}%
            </span>
          </div>
          <span className="text-sm text-white/30">vs last month</span>
        </motion.div>
      </div>

      {/* Flow indicators */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="flex gap-8"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <ArrowDownRight className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-white/40">Inflow</p>
            <p className="text-lg text-white">
              {formatCompact(inflow, currency)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
            <ArrowUpRight className="h-5 w-5 text-white/60" />
          </div>
          <div>
            <p className="text-xs text-white/40">Outflow</p>
            <p className="text-lg text-white/80">
              {formatCompact(outflow, currency)}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
