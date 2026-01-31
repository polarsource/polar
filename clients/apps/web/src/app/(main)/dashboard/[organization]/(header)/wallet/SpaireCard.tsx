'use client'

import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { Lock, Snowflake, Unlock } from 'lucide-react'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { type IssuingCard, mockIssuingCard } from './treasuryData'

interface SpaireCardProps {
  className?: string
}

const formatCardNumber = (number: string) => {
  return number.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()
}

const VirtualCard = ({
  card,
  isRevealed,
  onToggleReveal,
  isFrozen,
}: {
  card: IssuingCard
  isRevealed: boolean
  onToggleReveal: () => void
  isFrozen: boolean
}) => {
  return (
    <div
      className={twMerge(
        'relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-5',
        isFrozen && 'opacity-50',
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <span className="text-sm tracking-wide text-white/80">SPAIRE</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-white/50">{card.type}</span>
            <div
              className={twMerge(
                'h-1.5 w-1.5 rounded-full',
                card.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400',
              )}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <button
            onClick={onToggleReveal}
            className="flex items-center gap-1.5 text-white/40 transition-colors hover:text-white/60"
          >
            {isRevealed ? (
              <Unlock className="h-3 w-3" />
            ) : (
              <Lock className="h-3 w-3" />
            )}
            <span className="text-xs">
              {isRevealed ? 'Hide' : 'Reveal'}
            </span>
          </button>
          <p className="font-mono text-lg tracking-widest text-white">
            {isRevealed
              ? formatCardNumber(card.number || '')
              : `•••• •••• •••• ${card.last4}`}
          </p>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-white/40">Cardholder</p>
            <p className="text-sm text-white/80">{card.cardholder.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-white/40">Expires</p>
              <p className="font-mono text-sm text-white/80">
                {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
              </p>
            </div>
            {isRevealed && (
              <div className="text-right">
                <p className="text-xs text-white/40">CVC</p>
                <p className="font-mono text-sm text-white/80">{card.cvc}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <span className="text-lg italic text-white/60">{card.brand}</span>
        </div>
      </div>
    </div>
  )
}

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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="dark:text-polar-400 text-gray-500">{label}</span>
        <span>
          {formatCurrencyAndAmount(used, currency, 0)}{' '}
          <span className="dark:text-polar-500 text-gray-400">
            / {formatCurrencyAndAmount(limit, currency, 0)}
          </span>
        </span>
      </div>
      <div className="dark:bg-polar-700 h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div
          className={twMerge(
            'h-full rounded-full transition-all duration-500',
            isNearLimit ? 'bg-amber-500' : 'bg-emerald-500',
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export default function SpaireCard({ className }: SpaireCardProps) {
  const [card] = useState<IssuingCard>(mockIssuingCard)
  const [isRevealed, setIsRevealed] = useState(false)
  const [isFrozen, setIsFrozen] = useState(false)

  const dailySpent = 250000
  const monthlySpent = 1850000

  const dailyLimit = card.spending_controls.spending_limits.find(
    (l) => l.interval === 'daily',
  )
  const monthlyLimit = card.spending_controls.spending_limits.find(
    (l) => l.interval === 'monthly',
  )

  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 flex flex-col rounded-4xl bg-gray-50',
        className,
      )}
    >
      <div className="flex flex-col gap-y-4 p-4">
        <div className="flex flex-row items-center justify-between px-2 pt-2">
          <span className="text-lg">Corporate Card</span>
          <span
            className={twMerge(
              'rounded-full px-2 py-0.5 text-xs',
              card.status === 'active'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                : 'dark:bg-polar-700 dark:text-polar-400 bg-gray-100 text-gray-500',
            )}
          >
            {card.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        </div>

        <VirtualCard
          card={card}
          isRevealed={isRevealed}
          onToggleReveal={() => setIsRevealed(!isRevealed)}
          isFrozen={isFrozen}
        />

        {isFrozen && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
            <Snowflake className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-sm text-blue-600 dark:text-blue-400">
              Card frozen
            </span>
          </div>
        )}
      </div>

      <div className="dark:bg-polar-700 m-2 flex flex-col gap-y-4 rounded-3xl bg-white p-4">
        <div className="flex flex-row items-center justify-between">
          <span className="dark:text-polar-400 text-sm text-gray-500">
            Freeze Card
          </span>
          <button
            onClick={() => setIsFrozen(!isFrozen)}
            className={twMerge(
              'relative h-5 w-9 rounded-full transition-colors duration-200',
              isFrozen ? 'bg-blue-500' : 'dark:bg-polar-600 bg-gray-300',
            )}
          >
            <span
              className={twMerge(
                'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                isFrozen && 'translate-x-4',
              )}
            />
          </button>
        </div>

        <div className="dark:border-polar-600 border-t border-gray-100 pt-4">
          <p className="dark:text-polar-400 mb-3 text-xs text-gray-500">
            Spending Limits
          </p>
          <div className="space-y-3">
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
    </div>
  )
}
