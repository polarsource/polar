'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { Building2, ExternalLink, HelpCircle } from 'lucide-react'
import FinancialHub from './FinancialHub'
import SpaireCard from './SpaireCard'
import TransactionFeed from './TransactionFeed'

interface ClientPageProps {
  organizationSlug: string
}

export default function ClientPage({ organizationSlug }: ClientPageProps) {
  return (
    <DashboardBody className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
              Global Wallet
            </h1>
            <p className="dark:text-polar-400 mt-1 text-sm text-gray-600">
              Manage your treasury account, corporate cards, and financial
              operations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://stripe.com/treasury"
              target="_blank"
              rel="noopener noreferrer"
              className="dark:border-polar-600 dark:text-polar-300 dark:hover:border-polar-500 dark:hover:text-polar-200 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
            >
              <HelpCircle className="h-4 w-4" />
              Learn More
            </a>
          </div>
        </div>
      </div>

      {/* Sandbox Notice */}
      <div className="dark:border-polar-600 dark:bg-polar-800/50 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Sandbox Mode
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            You&apos;re viewing test data. Connect a live Stripe Treasury
            account to manage real funds.
          </p>
        </div>
        <a
          href="https://dashboard.stripe.com/treasury"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
        >
          Stripe Dashboard
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column - Financial Hub & Transactions */}
        <div className="flex flex-col gap-6">
          <FinancialHub />
          <TransactionFeed />
        </div>

        {/* Right Column - Spaire Card */}
        <div className="flex flex-col gap-6">
          <SpaireCard />

          {/* Quick Actions */}
          <div className="dark:border-polar-700 dark:bg-polar-900 rounded-2xl border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="dark:border-polar-600 dark:bg-polar-800 dark:hover:bg-polar-700 flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 transition-colors hover:bg-gray-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <svg
                    className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <span className="dark:text-polar-300 text-xs font-medium text-gray-700">
                  Add Funds
                </span>
              </button>

              <button className="dark:border-polar-600 dark:bg-polar-800 dark:hover:bg-polar-700 flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 transition-colors hover:bg-gray-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <svg
                    className="h-5 w-5 text-blue-600 dark:text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                </div>
                <span className="dark:text-polar-300 text-xs font-medium text-gray-700">
                  Transfer
                </span>
              </button>

              <button className="dark:border-polar-600 dark:bg-polar-800 dark:hover:bg-polar-700 flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 transition-colors hover:bg-gray-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <svg
                    className="h-5 w-5 text-purple-600 dark:text-purple-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                </div>
                <span className="dark:text-polar-300 text-xs font-medium text-gray-700">
                  New Card
                </span>
              </button>

              <button className="dark:border-polar-600 dark:bg-polar-800 dark:hover:bg-polar-700 flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 transition-colors hover:bg-gray-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-polar-700">
                  <svg
                    className="dark:text-polar-400 h-5 w-5 text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <span className="dark:text-polar-300 text-xs font-medium text-gray-700">
                  Settings
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardBody>
  )
}
