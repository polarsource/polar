'use client'

import { toast } from '@/components/Toast/use-toast'
import {
  BalanceHeader,
  GlassCard,
  RadiantBackground,
  StartupStackGrid,
} from '@/components/Spaire'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { motion } from 'framer-motion'
import {
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Lock,
  Plus,
  Receipt,
  Settings,
  Snowflake,
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

// Quick Action Button with glass effect
const QuickAction = ({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  variant?: 'emerald' | 'blue' | 'purple' | 'default'
}) => {
  const glowColors = {
    emerald: 'group-hover:text-emerald-400',
    blue: 'group-hover:text-blue-400',
    purple: 'group-hover:text-purple-400',
    default: 'group-hover:text-white/80',
  }

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={twMerge(
        'group flex items-center gap-3 rounded-2xl p-4',
        'bg-white/[0.03] backdrop-blur-xl',
        'border border-white/[0.08]',
        'transition-all duration-300',
        'hover:border-white/[0.15] hover:bg-white/[0.05]',
      )}
    >
      <Icon
        className={twMerge(
          'h-5 w-5 text-white/40 transition-colors',
          glowColors[variant],
        )}
      />
      <span className="text-sm text-white/60 transition-colors group-hover:text-white/80">
        {label}
      </span>
    </motion.button>
  )
}

// Virtual Card Display
const VirtualCardDisplay = () => {
  const [isRevealed, setIsRevealed] = useState(false)
  const [isFrozen, setIsFrozen] = useState(false)
  const card = mockIssuingCard

  return (
    <GlassCard padding="none" className="overflow-hidden">
      {/* Card Visual */}
      <div
        className={twMerge(
          'relative p-6',
          'bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80',
          isFrozen && 'opacity-60',
        )}
      >
        <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5">
          <div className="flex items-start justify-between">
            <span className="text-sm tracking-widest text-white/60">SPAIRE</span>
            <div
              className={twMerge(
                'h-2 w-2 rounded-full',
                card.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400',
              )}
            />
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setIsRevealed(!isRevealed)}
              className="flex items-center gap-1.5 text-white/30 transition-colors hover:text-white/50"
            >
              {isRevealed ? (
                <Unlock className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              <span className="text-xs">{isRevealed ? 'Hide' : 'Reveal'}</span>
            </button>
            <p className="font-mono text-xl tracking-widest text-white">
              {isRevealed
                ? card.number?.replace(/(.{4})/g, '$1 ').trim()
                : `•••• •••• •••• ${card.last4}`}
            </p>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-white/30">Cardholder</p>
              <p className="text-sm text-white/70">{card.cardholder.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/30">Expires</p>
              <p className="font-mono text-sm text-white/70">
                {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between border-t border-white/[0.06] p-4">
        <div className="flex items-center gap-2 text-white/40">
          <Snowflake className="h-4 w-4" />
          <span className="text-sm">Freeze Card</span>
        </div>
        <button
          onClick={() => setIsFrozen(!isFrozen)}
          className={twMerge(
            'relative h-5 w-9 rounded-full transition-colors',
            isFrozen ? 'bg-blue-500' : 'bg-white/10',
          )}
        >
          <span
            className={twMerge(
              'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
              isFrozen && 'translate-x-4',
            )}
          />
        </button>
      </div>

      {isFrozen && (
        <div className="flex items-center justify-center gap-2 border-t border-white/[0.06] bg-blue-500/10 px-4 py-2">
          <Snowflake className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs text-blue-400">Card frozen</span>
        </div>
      )}
    </GlassCard>
  )
}

// Recent Transactions
const RecentTransactions = () => {
  const transactions = mockTransactions.slice(0, 4)

  return (
    <GlassCard padding="none">
      <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
        <span className="text-sm font-medium text-white/80">
          Recent Activity
        </span>
        <Receipt className="h-4 w-4 text-white/30" />
      </div>
      <div className="divide-y divide-white/[0.04]">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between px-5 py-3"
          >
            <div className="flex items-center gap-3">
              {tx.amount > 0 ? (
                <ArrowDownRight className="h-4 w-4 text-emerald-400" />
              ) : (
                <ArrowUpRight className="h-4 w-4 text-white/40" />
              )}
              <div>
                <p className="text-sm text-white/70">{tx.description}</p>
                <p className="text-xs text-white/30">
                  {getRelativeTime(tx.created)}
                </p>
              </div>
            </div>
            <span
              className={twMerge(
                'font-mono text-sm tabular-nums',
                tx.amount > 0 ? 'text-emerald-400' : 'text-white/60',
              )}
            >
              {tx.amount > 0 ? '+' : ''}
              {formatCurrencyAndAmount(Math.abs(tx.amount), tx.currency, 0)}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

export default function ClientPage({ organizationSlug }: ClientPageProps) {
  const account = mockFinancialAccount
  const totalBalance =
    account.balance.available +
    account.balance.inbound_pending -
    account.balance.outbound_pending

  const handleSandboxAction = (action: string) => {
    toast({
      title: 'Sandbox Mode',
      description: `${action} is not available in sandbox. Connect a live Stripe Treasury account to enable.`,
    })
  }

  return (
    <RadiantBackground className="min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-12 lg:py-16">
        {/* Balance Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <BalanceHeader
            totalBalance={totalBalance}
            percentChange={12.5}
            inflow={8750000}
            outflow={3125000}
          />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-12"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-white/80">
              Quick Actions
            </h2>
            <button
              onClick={() => handleSandboxAction('Settings')}
              className="flex items-center gap-1.5 text-sm text-white/30 transition-colors hover:text-white/50"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickAction
              icon={Plus}
              label="Add Funds"
              variant="emerald"
              onClick={() => handleSandboxAction('Add Funds')}
            />
            <QuickAction
              icon={ArrowUpRight}
              label="Transfer"
              variant="blue"
              onClick={() => handleSandboxAction('Transfer')}
            />
            <QuickAction
              icon={CreditCard}
              label="New Card"
              variant="purple"
              onClick={() => handleSandboxAction('New Card')}
            />
            <QuickAction
              icon={Receipt}
              label="Statements"
              onClick={() => handleSandboxAction('Statements')}
            />
          </div>
        </motion.div>

        {/* Cards Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-16 grid gap-6 lg:grid-cols-2"
        >
          <VirtualCardDisplay />
          <RecentTransactions />
        </motion.div>

        {/* Startup Stack */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <StartupStackGrid maxItems={8} />
        </motion.div>
      </div>
    </RadiantBackground>
  )
}
