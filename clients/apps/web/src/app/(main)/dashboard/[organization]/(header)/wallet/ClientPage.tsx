'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { GlassCard } from '@/components/Spaire'
import { toast } from '@/components/Toast/use-toast'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Lock,
  Plus,
  Receipt,
  Snowflake,
  TrendingUp,
  Unlock,
} from 'lucide-react'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  getRelativeTime,
  mockFinancialAccount,
  mockIssuingCard,
  mockTransactions,
} from './treasuryData'

interface ClientPageProps {
  organizationSlug: string
}

export default function ClientPage({ organizationSlug }: ClientPageProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const [isFrozen, setIsFrozen] = useState(false)

  const account = mockFinancialAccount
  const card = mockIssuingCard
  const transactions = mockTransactions.slice(0, 5)

  const totalBalance =
    account.balance.available +
    account.balance.inbound_pending -
    account.balance.outbound_pending

  const handleSandboxAction = (action: string) => {
    toast({
      title: 'Sandbox Mode',
      description: `${action} is not available in sandbox mode.`,
    })
  }

  return (
    <DashboardBody className="flex flex-col gap-y-8">
      {/* Balance Overview */}
      <div className="flex flex-col gap-y-2">
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Total Balance
        </p>
        <div className="flex items-baseline gap-4">
          <h1 className="font-mono text-4xl tabular-nums tracking-tight">
            {formatCurrencyAndAmount(totalBalance, 'usd', 0)}
          </h1>
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">+12.5%</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Plus, label: 'Add Funds', color: 'text-emerald-600 dark:text-emerald-400' },
          { icon: ArrowUpRight, label: 'Transfer', color: 'text-blue-600 dark:text-blue-400' },
          { icon: CreditCard, label: 'New Card', color: 'text-purple-600 dark:text-purple-400' },
          { icon: Receipt, label: 'Statements', color: 'dark:text-polar-400 text-gray-600' },
        ].map(({ icon: Icon, label, color }) => (
          <GlassCard
            key={label}
            padding="sm"
            className="cursor-pointer"
            onClick={() => handleSandboxAction(label)}
          >
            <div className="flex items-center gap-3">
              <Icon className={twMerge('h-4 w-4', color)} />
              <span className="text-sm">{label}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Corporate Card */}
        <GlassCard padding="none">
          <div
            className={twMerge(
              'relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-5',
              isFrozen && 'opacity-50',
            )}
          >
            <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
            <div className="absolute -bottom-12 -left-12 h-24 w-24 rounded-full bg-blue-500/20 blur-2xl" />

            <div className="relative flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs tracking-widest text-white/50">SPAIRE</span>
                <div
                  className={twMerge(
                    'h-1.5 w-1.5 rounded-full',
                    card.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400',
                  )}
                />
              </div>

              <div>
                <button
                  onClick={() => setIsRevealed(!isRevealed)}
                  className="mb-1 flex items-center gap-1 text-white/30 hover:text-white/50"
                >
                  {isRevealed ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  <span className="text-xs">{isRevealed ? 'Hide' : 'Reveal'}</span>
                </button>
                <p className="font-mono text-lg tracking-wider text-white">
                  {isRevealed
                    ? card.number?.replace(/(.{4})/g, '$1 ').trim()
                    : `•••• •••• •••• ${card.last4}`}
                </p>
              </div>

              <div className="flex justify-between text-xs">
                <div>
                  <p className="text-white/30">Cardholder</p>
                  <p className="text-white/70">{card.cardholder.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/30">Expires</p>
                  <p className="font-mono text-white/70">
                    {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4">
            <div className="dark:text-polar-400 flex items-center gap-2 text-sm text-gray-500">
              <Snowflake className="h-4 w-4" />
              Freeze Card
            </div>
            <button
              onClick={() => setIsFrozen(!isFrozen)}
              className={twMerge(
                'relative h-5 w-9 rounded-full transition-colors',
                isFrozen ? 'bg-blue-500' : 'dark:bg-polar-600 bg-gray-200',
              )}
            >
              <span
                className={twMerge(
                  'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  isFrozen && 'translate-x-4',
                )}
              />
            </button>
          </div>

          {isFrozen && (
            <div className="flex items-center justify-center gap-2 border-t border-gray-100 bg-blue-50 py-2 dark:border-white/5 dark:bg-blue-500/10">
              <Snowflake className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-blue-600 dark:text-blue-400">Card frozen</span>
            </div>
          )}
        </GlassCard>

        {/* Recent Activity */}
        <GlassCard padding="none">
          <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-white/5">
            <span className="text-sm">Recent Activity</span>
            <Receipt className="dark:text-polar-500 h-4 w-4 text-gray-400" />
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {tx.amount > 0 ? (
                    <ArrowDownRight className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ArrowUpRight className="dark:text-polar-500 h-4 w-4 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm">{tx.description}</p>
                    <p className="dark:text-polar-500 text-xs text-gray-400">
                      {getRelativeTime(tx.created)}
                    </p>
                  </div>
                </div>
                <span
                  className={twMerge(
                    'font-mono text-sm tabular-nums',
                    tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : '',
                  )}
                >
                  {tx.amount > 0 ? '+' : ''}
                  {formatCurrencyAndAmount(Math.abs(tx.amount), tx.currency, 0)}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Balance Breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard>
          <p className="dark:text-polar-500 text-xs text-gray-500">Available</p>
          <p className="font-mono text-xl tabular-nums">
            {formatCurrencyAndAmount(account.balance.available, 'usd', 0)}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="dark:text-polar-500 text-xs text-gray-500">Pending In</p>
          <p className="font-mono text-xl tabular-nums text-emerald-600 dark:text-emerald-400">
            +{formatCurrencyAndAmount(account.balance.inbound_pending, 'usd', 0)}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="dark:text-polar-500 text-xs text-gray-500">Pending Out</p>
          <p className="dark:text-polar-400 font-mono text-xl tabular-nums text-gray-500">
            -{formatCurrencyAndAmount(account.balance.outbound_pending, 'usd', 0)}
          </p>
        </GlassCard>
      </div>
    </DashboardBody>
  )
}
