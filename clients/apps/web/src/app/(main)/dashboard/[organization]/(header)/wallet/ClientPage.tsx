'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { toast } from '@/components/Toast/use-toast'
import Button from '@spaire/ui/components/atoms/Button'
import { ArrowUpRight, CreditCard, Plus, Settings } from 'lucide-react'
import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import FinancialHub from './FinancialHub'
import SpaireCard from './SpaireCard'
import TransactionFeed from './TransactionFeed'

interface ClientPageProps {
  organizationSlug: string
}

const QuickActionButton = ({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  variant?: 'default' | 'primary'
}) => (
  <Button
    variant={variant === 'primary' ? 'default' : 'secondary'}
    size="sm"
    onClick={onClick}
    className={twMerge(
      'flex items-center gap-2 rounded-full',
      variant === 'default' && 'border-none',
    )}
  >
    <Icon className="h-4 w-4" />
    {label}
  </Button>
)

export default function ClientPage({ organizationSlug }: ClientPageProps) {
  const handleSandboxAction = (action: string) => {
    toast({
      title: 'Sandbox Mode',
      description: `${action} is not available in sandbox mode. Connect a live Stripe Treasury account to enable this feature.`,
    })
  }

  return (
    <DashboardBody className="flex flex-col gap-y-8">
      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-wrap gap-3"
      >
        <QuickActionButton
          icon={Plus}
          label="Add Funds"
          onClick={() => handleSandboxAction('Add Funds')}
          variant="primary"
        />
        <QuickActionButton
          icon={ArrowUpRight}
          label="Transfer"
          onClick={() => handleSandboxAction('Transfer')}
        />
        <QuickActionButton
          icon={CreditCard}
          label="New Card"
          onClick={() => handleSandboxAction('Issue Card')}
        />
        <QuickActionButton
          icon={Settings}
          label="Settings"
          onClick={() => handleSandboxAction('Settings')}
        />
      </motion.div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="lg:col-span-2"
        >
          <FinancialHub />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <TransactionFeed />
        </motion.div>
      </div>

      {/* Card Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <SpaireCard />
      </motion.div>

      {/* Compliance Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="dark:border-polar-700 mt-4 border-t border-gray-200 pt-6"
      >
        <div className="flex flex-col gap-3">
          <p className="dark:text-polar-500 text-[13px] leading-relaxed text-gray-500">
            Financial Account services are provided by Evolve Bank & Trust, Member FDIC.
            The Spaire Visa Commercial Card is issued by Evolve Bank & Trust, Member FDIC,
            pursuant to a license from Visa U.S.A. Inc.
          </p>
          <p className="dark:text-polar-500 text-[13px] leading-relaxed text-gray-500">
            Spaire Technologies, Inc. is a financial technology company, not a bank.
            Financial Account services are provided by Evolve Bank & Trust, Member FDIC.
            Funds held in your Financial Account are eligible for FDIC insurance up to $250,000.
          </p>
        </div>
      </motion.div>
    </DashboardBody>
  )
}
