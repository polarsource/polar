'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  ArrowRight,
  Shield,
  Zap,
  BarChart3,
  Globe,
  Lock,
  RefreshCw,
} from 'lucide-react'
import SDSCard, { SDSCardTitle } from './SDSCard'
import SDSButton from './SDSButton'
import WalletView, { WalletStat } from './WalletView'
import ComplianceFooter from './ComplianceFooter'

/**
 * Spaire Homepage
 * Built with Stripe Design System (SDS) principles
 *
 * Features:
 * - Engineered, elegant, high-density UI
 * - 8px grid system
 * - Vibrant Neutral color palette
 * - Sophisticated dark/light mode transitions
 */

// Mock data for demonstration
const mockTransactions = [
  {
    id: '1',
    description: 'AWS Services',
    amount: 12450,
    currency: 'usd',
    type: 'debit' as const,
    category: 'Software',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    cardLast4: '4242',
  },
  {
    id: '2',
    description: 'Stripe Payout',
    amount: 84320,
    currency: 'usd',
    type: 'credit' as const,
    category: 'Income',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
  },
  {
    id: '3',
    description: 'Google Cloud Platform',
    amount: 8920,
    currency: 'usd',
    type: 'debit' as const,
    category: 'Software',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    cardLast4: '4242',
  },
  {
    id: '4',
    description: 'Vercel Pro',
    amount: 2000,
    currency: 'usd',
    type: 'debit' as const,
    category: 'Software',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
    cardLast4: '8888',
  },
  {
    id: '5',
    description: 'Customer Payment',
    amount: 150000,
    currency: 'usd',
    type: 'credit' as const,
    category: 'Income',
    timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000),
  },
]

export default function SpaireHomepage() {
  const [, setShowAddFunds] = useState(false)

  return (
    <div className="min-h-screen bg-[#F6F9FC] dark:bg-[#0A192F] transition-colors duration-300">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-[#E3E8EF] dark:border-[#1E3A5F] bg-white/80 dark:bg-[#0A192F]/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#635BFF]">
                  <span className="text-sm font-semibold text-white tracking-tight">S</span>
                </div>
                <span className="text-lg font-semibold text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.02em]">
                  Spaire
                </span>
              </div>

              {/* Nav Links */}
              <div className="hidden md:flex items-center gap-6">
                <NavLink active>Overview</NavLink>
                <NavLink>Treasury</NavLink>
                <NavLink>Cards</NavLink>
                <NavLink>Transactions</NavLink>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <SDSButton variant="ghost" size="sm">
                Documentation
              </SDSButton>
              <SDSButton variant="primary" size="sm">
                Get Started
              </SDSButton>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-8 md:px-8 md:py-12">
        {/* Hero Section */}
        <section className="mb-12">
          <div className="flex flex-col gap-4 mb-8">
            <h1 className="text-3xl md:text-4xl font-semibold text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.02em]">
              Financial infrastructure for modern businesses
            </h1>
            <p className="text-lg text-[#425466] dark:text-[#A8B2D1] tracking-[-0.01em] max-w-2xl">
              Manage your treasury, issue commercial cards, and automate financial operations with a single, unified platform.
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-8">
            <WalletStat
              label="Total Volume"
              value="$2.4M"
              change={{ value: 12.5, direction: 'up' }}
            />
            <WalletStat
              label="Active Cards"
              value="24"
              change={{ value: 8, direction: 'up' }}
            />
            <WalletStat
              label="Transactions"
              value="1,284"
              change={{ value: 23, direction: 'up' }}
            />
            <WalletStat
              label="Yield Earned"
              value="$4,820"
              change={{ value: 4.2, direction: 'up' }}
            />
          </div>
        </section>

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Wallet View - Takes 2 columns */}
          <div className="lg:col-span-2">
            <WalletView
              availableBalance={28456032}
              pendingPayouts={1245000}
              transactions={mockTransactions}
              onAddFunds={() => setShowAddFunds(true)}
              onTransfer={() => {}}
            />
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6">
            {/* Quick Actions */}
            <SDSCard padding="md">
              <SDSCardTitle className="mb-4">Quick Actions</SDSCardTitle>
              <div className="flex flex-col gap-2">
                <QuickAction
                  icon={<Zap className="h-4 w-4" />}
                  label="Issue New Card"
                  description="Virtual or physical"
                />
                <QuickAction
                  icon={<RefreshCw className="h-4 w-4" />}
                  label="Schedule Transfer"
                  description="Automated payouts"
                />
                <QuickAction
                  icon={<BarChart3 className="h-4 w-4" />}
                  label="View Reports"
                  description="Analytics & insights"
                />
              </div>
            </SDSCard>

            {/* Security Status */}
            <SDSCard padding="md">
              <SDSCardTitle className="mb-4">Security</SDSCardTitle>
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
                <SecurityItem
                  icon={<Globe className="h-4 w-4" />}
                  label="IP Allowlist"
                  status="inactive"
                />
              </div>
            </SDSCard>

            {/* APY Card */}
            <SDSCard
              padding="md"
              className="bg-gradient-to-br from-[#635BFF] to-[#4338CA] border-0"
            >
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
            </SDSCard>
          </div>
        </div>

        {/* Features Section */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.02em] mb-8">
            Built for scale
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <FeatureCard
              title="Treasury Management"
              description="Optimize cash flow with automated sweeps, multi-currency support, and real-time visibility."
              icon={<BarChart3 className="h-5 w-5" />}
            />
            <FeatureCard
              title="Commercial Cards"
              description="Issue virtual and physical cards instantly with custom spend controls and real-time notifications."
              icon={<Zap className="h-5 w-5" />}
            />
            <FeatureCard
              title="Enterprise Security"
              description="Bank-grade encryption, SOC 2 Type II certified, with comprehensive audit trails."
              icon={<Shield className="h-5 w-5" />}
            />
          </div>
        </section>
      </main>

      {/* Compliance Footer */}
      <ComplianceFooter />
    </div>
  )
}

/**
 * Navigation Link Component
 */
function NavLink({
  children,
  active = false,
}: {
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <a
      href="#"
      className={twMerge(
        'text-sm font-medium tracking-[-0.01em] transition-colors duration-150',
        active
          ? 'text-[#635BFF]'
          : 'text-[#697386] dark:text-[#8892B0] hover:text-[#0A2540] dark:hover:text-[#E6F1FF]'
      )}
    >
      {children}
    </a>
  )
}

/**
 * Quick Action Component
 */
function QuickAction({
  icon,
  label,
  description,
}: {
  icon: React.ReactNode
  label: string
  description: string
}) {
  return (
    <button className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-[#F6F9FC] dark:hover:bg-[#1D3A5F] transition-colors group text-left">
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

/**
 * Security Item Component
 */
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

/**
 * Feature Card Component
 */
function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <SDSCard padding="lg" interactive>
      <div className="flex flex-col gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF2FF] dark:bg-[#312E81] text-[#635BFF]">
          {icon}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-medium text-[#0A2540] dark:text-[#E6F1FF] tracking-[-0.01em]">
            {title}
          </h3>
          <p className="text-sm text-[#697386] dark:text-[#8892B0] tracking-[-0.01em] leading-relaxed">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[#635BFF] dark:text-[#818CF8]">
          <span className="text-sm font-medium">Learn more</span>
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </SDSCard>
  )
}
