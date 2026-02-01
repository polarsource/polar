'use client'

import { toast } from '@/components/Toast/use-toast'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  Building2,
  CreditCard,
  Clock,
  Lock,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Shield,
  Snowflake,
  Unlock,
  Zap,
  BarChart3,
} from 'lucide-react'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  getRelativeTime,
  mockFinancialAccount,
  mockIssuingCard,
  mockTransactions,
} from './treasuryData'

/**
 * Spaire Wallet Page
 * Built with Stripe Design System (SDS) principles
 *
 * Features:
 * - 8px grid system
 * - Vibrant Neutral color palette
 * - Elevated Flat card style
 * - Professional typography with Poppins
 */

interface ClientPageProps {
  organizationSlug: string
}

export default function ClientPage({ organizationSlug }: ClientPageProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const [isFrozen, setIsFrozen] = useState(false)

  const account = mockFinancialAccount
  const card = mockIssuingCard
  const transactions = mockTransactions.slice(0, 5)

  const availableBalance = account.balance.available
  const pendingPayouts = account.balance.inbound_pending

  const handleSandboxAction = (action: string) => {
    toast({
      title: 'Sandbox Mode',
      description: `${action} is not available in sandbox mode.`,
    })
  }

  return (
    <div className="min-h-screen bg-[#F6F9FC] dark:bg-[#0A192F] -m-4 md:-m-8">
      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-8">
        {/* Page Header */}
        <div className="flex flex-col gap-2 mb-8">
          <h1 className="text-2xl font-semibold text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.02em]">
            Financial Account
          </h1>
          <p className="text-sm text-[#697386] dark:text-[#8892B0] tracking-[-0.01em]">
            Manage your treasury, cards, and transactions
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-8">
          <StatCard
            label="Available Balance"
            value={formatCurrencyAndAmount(availableBalance, 'usd', 0)}
            change={{ value: 12.5, direction: 'up' }}
          />
          <StatCard
            label="Pending Payouts"
            value={formatCurrencyAndAmount(pendingPayouts, 'usd', 0)}
          />
          <StatCard
            label="Active Cards"
            value="3"
          />
          <StatCard
            label="This Month"
            value={formatCurrencyAndAmount(account.balance.outbound_pending, 'usd', 0)}
            sublabel="Spend"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Balance Card */}
            <SDSCard>
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF2FF] dark:bg-[#312E81]">
                      <Building2 className="h-5 w-5 text-[#635BFF]" />
                    </div>
                    <div>
                      <h2 className="text-base font-medium text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em]">
                        Treasury Account
                      </h2>
                      <p className="text-sm text-[#697386] dark:text-[#8892B0] tracking-[-0.01em]">
                        Powered by Spaire
                      </p>
                    </div>
                  </div>
                  <button className="p-2 rounded-lg hover:bg-[#F6F9FC] dark:hover:bg-[#1D3A5F] transition-colors">
                    <MoreHorizontal className="h-5 w-5 text-[#697386] dark:text-[#8892B0]" />
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-sm text-[#697386] dark:text-[#8892B0] tracking-[-0.01em]">
                    Total Balance
                  </span>
                  <span className="text-4xl font-semibold text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.02em]">
                    {formatCurrencyAndAmount(
                      availableBalance + pendingPayouts,
                      'usd',
                      0
                    )}
                  </span>
                </div>

                <div className="flex gap-3">
                  <SDSButton onClick={() => handleSandboxAction('Add Funds')}>
                    <Plus className="h-4 w-4" />
                    Add Funds
                  </SDSButton>
                  <SDSButton
                    variant="secondary"
                    onClick={() => handleSandboxAction('Transfer')}
                  >
                    Transfer
                  </SDSButton>
                </div>
              </div>
            </SDSCard>

            {/* Commercial Card */}
            <SDSCard padding="none">
              <div className="p-6 border-b border-[#E3E8EF] dark:border-[#1E3A5F]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F0FDFA] dark:bg-[#134E4A]">
                      <CreditCard className="h-5 w-5 text-[#14B8A6]" />
                    </div>
                    <div>
                      <h2 className="text-base font-medium text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em]">
                        Commercial Card
                      </h2>
                      <p className="text-sm text-[#697386] dark:text-[#8892B0] tracking-[-0.01em]">
                        Visa Business
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={twMerge(
                        'text-xs font-medium px-2 py-1 rounded-full',
                        card.status === 'active'
                          ? 'bg-[#ECFDF5] dark:bg-[#064E3B] text-[#10B981]'
                          : 'bg-[#FEF3C7] dark:bg-[#78350F] text-[#F59E0B]'
                      )}
                    >
                      {card.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Display */}
              <div
                className={twMerge(
                  'relative overflow-hidden bg-gradient-to-br from-[#0A2540] via-[#112240] to-[#0A192F] p-6',
                  isFrozen && 'opacity-60'
                )}
              >
                <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-[#635BFF]/10 blur-3xl" />
                <div className="absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-[#14B8A6]/10 blur-3xl" />

                <div className="relative flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium tracking-widest text-white/40">
                      SPAIRE
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsRevealed(!isRevealed)}
                        className="flex items-center gap-1.5 text-white/50 hover:text-white/70 transition-colors"
                      >
                        {isRevealed ? (
                          <Unlock className="h-3.5 w-3.5" />
                        ) : (
                          <Lock className="h-3.5 w-3.5" />
                        )}
                        <span className="text-xs font-medium">
                          {isRevealed ? 'Hide' : 'Reveal'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="font-mono text-xl tracking-wider text-white">
                      {isRevealed
                        ? card.number?.replace(/(.{4})/g, '$1 ').trim()
                        : `•••• •••• •••• ${card.last4}`}
                    </p>
                  </div>

                  <div className="flex justify-between">
                    <div>
                      <p className="text-xs text-white/40 mb-1">Cardholder</p>
                      <p className="text-sm text-white/80">
                        {card.cardholder.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/40 mb-1">Expires</p>
                      <p className="font-mono text-sm text-white/80">
                        {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Controls */}
              <div className="flex items-center justify-between p-4 border-t border-[#E3E8EF] dark:border-[#1E3A5F]">
                <div className="flex items-center gap-2 text-sm text-[#697386] dark:text-[#8892B0]">
                  <Snowflake className="h-4 w-4" />
                  <span className="tracking-[-0.01em]">Freeze Card</span>
                </div>
                <button
                  onClick={() => setIsFrozen(!isFrozen)}
                  className={twMerge(
                    'relative h-6 w-11 rounded-full transition-colors',
                    isFrozen
                      ? 'bg-[#635BFF]'
                      : 'bg-[#E3E8EF] dark:bg-[#1E3A5F]'
                  )}
                >
                  <span
                    className={twMerge(
                      'absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                      isFrozen && 'translate-x-5'
                    )}
                  />
                </button>
              </div>

              {isFrozen && (
                <div className="flex items-center justify-center gap-2 py-3 bg-[#EEF2FF] dark:bg-[#312E81] border-t border-[#E3E8EF] dark:border-[#1E3A5F]">
                  <Snowflake className="h-3.5 w-3.5 text-[#635BFF]" />
                  <span className="text-xs font-medium text-[#635BFF] tracking-[-0.01em]">
                    Card is frozen
                  </span>
                </div>
              )}
            </SDSCard>

            {/* Recent Transactions */}
            <SDSCard padding="none">
              <div className="flex items-center justify-between p-6 border-b border-[#E3E8EF] dark:border-[#1E3A5F]">
                <h2 className="text-base font-medium text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em]">
                  Recent Transactions
                </h2>
                <button className="text-sm font-medium text-[#635BFF] dark:text-[#818CF8] hover:underline tracking-[-0.01em]">
                  View All
                </button>
              </div>
              <div className="divide-y divide-[#E3E8EF] dark:divide-[#1E3A5F]">
                {transactions.map((tx) => (
                  <TransactionRow key={tx.id} transaction={tx} />
                ))}
              </div>
            </SDSCard>
          </div>

          {/* Right Column - 1/3 width */}
          <div className="flex flex-col gap-6">
            {/* Quick Actions */}
            <SDSCard>
              <h3 className="text-sm font-medium text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em] mb-4">
                Quick Actions
              </h3>
              <div className="flex flex-col gap-2">
                <QuickAction
                  icon={<Zap className="h-4 w-4" />}
                  label="Issue New Card"
                  description="Virtual or physical"
                  onClick={() => handleSandboxAction('Issue Card')}
                />
                <QuickAction
                  icon={<RefreshCw className="h-4 w-4" />}
                  label="Schedule Transfer"
                  description="Automated payouts"
                  onClick={() => handleSandboxAction('Schedule Transfer')}
                />
                <QuickAction
                  icon={<BarChart3 className="h-4 w-4" />}
                  label="View Reports"
                  description="Analytics & insights"
                  onClick={() => handleSandboxAction('View Reports')}
                />
              </div>
            </SDSCard>

            {/* Security */}
            <SDSCard>
              <h3 className="text-sm font-medium text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em] mb-4">
                Security
              </h3>
              <div className="flex flex-col gap-3">
                <SecurityItem
                  icon={<Shield className="h-4 w-4" />}
                  label="FDIC Insured"
                  status="active"
                />
                <SecurityItem
                  icon={<Lock className="h-4 w-4" />}
                  label="2FA Enabled"
                  status="active"
                />
              </div>
            </SDSCard>

            {/* APY Card */}
            <div className="rounded-xl bg-gradient-to-br from-[#635BFF] to-[#4338CA] p-6 shadow-[0_4px_6px_-1px_rgba(99,91,255,0.2),0_2px_4px_-2px_rgba(99,91,255,0.1)]">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-white/70 tracking-[-0.01em]">
                  Current APY
                </span>
                <span className="text-3xl font-semibold text-white tracking-[-0.02em]">
                  4.25%
                </span>
                <p className="text-sm text-white/70 tracking-[-0.01em] mt-2">
                  Earn yield on your idle balance automatically.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Footer */}
        <div className="mt-12 pt-8 border-t border-[#E3E8EF] dark:border-[#1E3A5F]">
          <p className="text-[13px] text-[#697386] dark:text-[#8892B0] leading-relaxed">
            Financial Account services are provided by Evolve Bank & Trust, Member FDIC.
            The Spaire Visa Commercial Card is issued by Evolve Bank & Trust, Member FDIC,
            pursuant to a license from Visa U.S.A. Inc. Spaire Technologies, Inc. is a
            financial technology company, not a bank.
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function SDSCard({
  children,
  className,
  padding = 'default',
}: {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'default'
}) {
  return (
    <div
      className={twMerge(
        'rounded-xl bg-white dark:bg-[#112240]',
        'border border-[#E3E8EF] dark:border-[#1E3A5F]',
        'shadow-[0_1px_3px_0_rgba(0,0,0,0.08),0_1px_2px_-1px_rgba(0,0,0,0.04)]',
        'dark:shadow-[0_2px_4px_0_rgba(0,0,0,0.3),0_1px_2px_-1px_rgba(0,0,0,0.2)]',
        padding === 'default' && 'p-6',
        className
      )}
    >
      {children}
    </div>
  )
}

function SDSButton({
  children,
  variant = 'primary',
  onClick,
}: {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={twMerge(
        'inline-flex items-center justify-center gap-2',
        'h-10 px-4 rounded-lg',
        'text-sm font-medium tracking-[-0.01em]',
        'transition-all duration-150',
        variant === 'primary' && [
          'bg-[#635BFF] text-white',
          'hover:bg-[#5046E5]',
          'active:bg-[#4338CA]',
        ],
        variant === 'secondary' && [
          'bg-white dark:bg-[#112240]',
          'text-[#0A2540] dark:text-[#E6F1FF]',
          'border border-[#D1D9E6] dark:border-[#2D4A6F]',
          'hover:bg-[#F6F9FC] dark:hover:bg-[#1D3A5F]',
        ]
      )}
    >
      {children}
    </button>
  )
}

function StatCard({
  label,
  value,
  sublabel,
  change,
}: {
  label: string
  value: string
  sublabel?: string
  change?: { value: number; direction: 'up' | 'down' }
}) {
  return (
    <SDSCard>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-[#697386] dark:text-[#8892B0] tracking-[-0.01em]">
          {label}
        </span>
        <span className="text-2xl font-semibold text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.02em]">
          {value}
        </span>
        {sublabel && (
          <span className="text-xs text-[#8792A2] dark:text-[#5C6B8A]">
            {sublabel}
          </span>
        )}
        {change && (
          <div className="flex items-center gap-1 mt-1">
            {change.direction === 'up' ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-[#10B981]" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-[#EF4444]" />
            )}
            <span
              className={twMerge(
                'text-xs font-medium',
                change.direction === 'up' ? 'text-[#10B981]' : 'text-[#EF4444]'
              )}
            >
              {change.value}%
            </span>
          </div>
        )}
      </div>
    </SDSCard>
  )
}

function TransactionRow({
  transaction,
}: {
  transaction: (typeof mockTransactions)[0]
}) {
  const isCredit = transaction.amount > 0

  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-[#F6F9FC] dark:hover:bg-[#1D3A5F] transition-colors">
      <div className="flex items-center gap-4">
        <div
          className={twMerge(
            'flex h-9 w-9 items-center justify-center rounded-full',
            isCredit
              ? 'bg-[#ECFDF5] dark:bg-[#064E3B]'
              : 'bg-[#F6F9FC] dark:bg-[#1D3A5F]'
          )}
        >
          {isCredit ? (
            <ArrowDownRight className="h-4 w-4 text-[#10B981]" />
          ) : (
            <ArrowUpRight className="h-4 w-4 text-[#697386] dark:text-[#8892B0]" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em]">
            {transaction.description}
          </span>
          <span className="text-xs text-[#697386] dark:text-[#8892B0]">
            {getRelativeTime(transaction.created)}
          </span>
        </div>
      </div>
      <span
        className={twMerge(
          'text-sm font-medium tracking-[-0.01em] tabular-nums',
          isCredit
            ? 'text-[#10B981] dark:text-[#34D399]'
            : 'text-[#0A2540] dark:text-[#E6F1FF]'
        )}
      >
        {isCredit ? '+' : '-'}
        {formatCurrencyAndAmount(Math.abs(transaction.amount), transaction.currency, 0)}
      </span>
    </div>
  )
}

function QuickAction({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-[#F6F9FC] dark:hover:bg-[#1D3A5F] transition-colors group text-left"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF2FF] dark:bg-[#312E81] text-[#635BFF] group-hover:bg-[#635BFF] group-hover:text-white transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <span className="text-sm font-medium text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em] block">
          {label}
        </span>
        <span className="text-xs text-[#697386] dark:text-[#8892B0] tracking-[-0.01em]">
          {description}
        </span>
      </div>
      <ArrowRight className="h-4 w-4 text-[#8792A2] dark:text-[#5C6B8A] opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}

function SecurityItem({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode
  label: string
  status: 'active' | 'inactive'
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F6F9FC] dark:bg-[#1D3A5F] text-[#697386] dark:text-[#8892B0]">
          {icon}
        </div>
        <span className="text-sm text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em]">
          {label}
        </span>
      </div>
      <span
        className={twMerge(
          'text-xs font-medium px-2 py-0.5 rounded-full',
          status === 'active'
            ? 'bg-[#ECFDF5] dark:bg-[#064E3B] text-[#10B981] dark:text-[#34D399]'
            : 'bg-[#F6F9FC] dark:bg-[#1D3A5F] text-[#8792A2] dark:text-[#5C6B8A]'
        )}
      >
        {status === 'active' ? 'Active' : 'Setup'}
      </span>
    </div>
  )
}
