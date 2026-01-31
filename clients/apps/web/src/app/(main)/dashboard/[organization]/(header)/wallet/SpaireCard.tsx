'use client'

import { CreditCard, Lock, Shield, Snowflake, Unlock } from 'lucide-react'
import { useState } from 'react'
import {
  formatCurrency,
  type IssuingCard,
  mockIssuingCard,
} from './treasuryData'

interface SpaireCardProps {
  className?: string
}

// Card number formatter
const formatCardNumber = (number: string) => {
  return number.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()
}

// Virtual card display with glassmorphism
const VirtualCard = ({
  card,
  isRevealed,
  onToggleReveal,
}: {
  card: IssuingCard
  isRevealed: boolean
  onToggleReveal: () => void
}) => {
  return (
    <div className="relative">
      {/* Card container with glassmorphism */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 shadow-2xl">
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
        <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />

        {/* Card content */}
        <div className="relative z-10 flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                <CreditCard className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-semibold tracking-wide text-white/90">
                SPAIRE
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-white/60">
                {card.type.toUpperCase()}
              </span>
              <div
                className={`h-2 w-2 rounded-full ${
                  card.status === 'active'
                    ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50'
                    : 'bg-amber-400 shadow-lg shadow-amber-400/50'
                }`}
              />
            </div>
          </div>

          {/* Card number */}
          <div className="space-y-2">
            <button
              onClick={onToggleReveal}
              className="group flex items-center gap-2 text-white/40 transition-colors hover:text-white/60"
            >
              {isRevealed ? (
                <Unlock className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              <span className="text-xs font-medium">
                {isRevealed ? 'Hide details' : 'Reveal details'}
              </span>
            </button>
            <p className="font-mono text-xl tracking-widest text-white">
              {isRevealed
                ? formatCardNumber(card.number || '')
                : `•••• •••• •••• ${card.last4}`}
            </p>
          </div>

          {/* Card details */}
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                Cardholder
              </p>
              <p className="text-sm font-medium tracking-wide text-white/90">
                {card.cardholder.name}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="space-y-1 text-right">
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                  Expires
                </p>
                <p className="font-mono text-sm text-white/90">
                  {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
                </p>
              </div>
              {isRevealed && (
                <div className="space-y-1 text-right">
                  <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                    CVC
                  </p>
                  <p className="font-mono text-sm text-white/90">{card.cvc}</p>
                </div>
              )}
            </div>
          </div>

          {/* Brand logo */}
          <div className="flex justify-end">
            <div className="text-xl font-bold italic tracking-tight text-white/80">
              {card.brand}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Spending limit progress bar
const SpendingLimitBar = ({
  label,
  limit,
  used,
  currency,
}: {
  label: string
  limit: number
  used: number
  currency: string
}) => {
  const percentage = Math.min((used / limit) * 100, 100)
  const isNearLimit = percentage >= 80

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="dark:text-polar-400 font-medium text-gray-600">
          {label}
        </span>
        <span className="dark:text-polar-300 text-gray-700">
          {formatCurrency(used, currency)}{' '}
          <span className="dark:text-polar-500 text-gray-400">
            / {formatCurrency(limit, currency)}
          </span>
        </span>
      </div>
      <div className="dark:bg-polar-700 h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isNearLimit
              ? 'bg-amber-500'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export default function SpaireCard({ className = '' }: SpaireCardProps) {
  const [card] = useState<IssuingCard>(mockIssuingCard)
  const [isRevealed, setIsRevealed] = useState(false)
  const [isFrozen, setIsFrozen] = useState(false)

  // Mock spending data
  const dailySpent = 250000 // $2,500
  const monthlySpent = 1850000 // $18,500

  const dailyLimit = card.spending_controls.spending_limits.find(
    (l) => l.interval === 'daily',
  )
  const monthlyLimit = card.spending_controls.spending_limits.find(
    (l) => l.interval === 'monthly',
  )

  return (
    <div
      className={`dark:border-polar-700 dark:bg-polar-900 rounded-2xl border border-gray-200 bg-white ${className}`}
    >
      {/* Header */}
      <div className="dark:border-polar-800 flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="dark:bg-polar-800 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
            <CreditCard className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Spaire Card
            </h2>
            <p className="dark:text-polar-500 text-xs text-gray-500">
              Stripe Issuing
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            card.status === 'active'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'dark:bg-polar-800 dark:text-polar-400 bg-gray-100 text-gray-600'
          }`}
        >
          {card.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Card Display */}
      <div className="p-6">
        <div className={`transition-opacity ${isFrozen ? 'opacity-50' : ''}`}>
          <VirtualCard
            card={card}
            isRevealed={isRevealed}
            onToggleReveal={() => setIsRevealed(!isRevealed)}
          />
        </div>

        {/* Frozen overlay message */}
        {isFrozen && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-900/20">
            <Snowflake className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Card is frozen. Unfreeze to make purchases.
            </span>
          </div>
        )}
      </div>

      {/* Card Controls */}
      <div className="dark:border-polar-800 border-t border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="dark:text-polar-500 h-4 w-4 text-gray-400" />
            <span className="dark:text-polar-300 text-sm font-medium text-gray-700">
              Freeze Card
            </span>
          </div>
          <button
            onClick={() => setIsFrozen(!isFrozen)}
            className={`relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-polar-900 ${
              isFrozen
                ? 'bg-blue-500 focus:ring-blue-500'
                : 'dark:bg-polar-600 bg-gray-200 focus:ring-gray-400'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                isFrozen ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Spending Limits */}
      <div className="dark:border-polar-800 dark:bg-polar-800/50 border-t border-gray-100 bg-gray-50/50 px-6 py-5">
        <h3 className="dark:text-polar-300 mb-4 text-sm font-semibold text-gray-700">
          Spending Limits
        </h3>
        <div className="space-y-4">
          {dailyLimit && (
            <SpendingLimitBar
              label="Daily"
              limit={dailyLimit.amount}
              used={dailySpent}
              currency={card.spending_controls.spending_limits_currency}
            />
          )}
          {monthlyLimit && (
            <SpendingLimitBar
              label="Monthly"
              limit={monthlyLimit.amount}
              used={monthlySpent}
              currency={card.spending_controls.spending_limits_currency}
            />
          )}
        </div>
      </div>
    </div>
  )
}
