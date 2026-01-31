'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { toast } from '@/components/Toast/use-toast'
import Button from '@polar-sh/ui/components/atoms/Button'
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
  icon: React.ElementType
  label: string
  onClick: () => void
  variant?: 'default' | 'emerald' | 'blue' | 'purple'
}) => {
  const iconColors = {
    default: 'dark:text-polar-400 text-gray-600',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
  }

  return (
    <button
      onClick={onClick}
      className="dark:bg-polar-700 dark:hover:bg-polar-600 flex items-center gap-3 rounded-2xl bg-white p-3 transition-colors hover:bg-gray-50"
    >
      <Icon className={twMerge('h-5 w-5', iconColors[variant])} />
      <span className="text-sm">{label}</span>
    </button>
  )
}

export default function ClientPage({ organizationSlug }: ClientPageProps) {
  const handleSandboxAction = (action: string) => {
    toast({
      title: 'Sandbox Mode',
      description: `${action} is not available in sandbox mode. Connect a live Stripe Treasury account to enable this feature.`,
    })
  }

  const motionVariants = {
    variants: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.3 } },
      exit: { opacity: 0, transition: { duration: 0.3 } },
    },
  }

  const cardClassName = 'flex w-full flex-col h-full'

  return (
    <DashboardBody className="gap-y-8 pb-16 md:gap-y-10">
      <motion.div
        className="grid grid-cols-1 gap-6 md:gap-8 xl:grid-cols-3"
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ staggerChildren: 0.1 }}
      >
        <motion.div className={cardClassName} {...motionVariants}>
          <FinancialHub />
        </motion.div>
        <motion.div className={cardClassName} {...motionVariants}>
          <SpaireCard />
        </motion.div>
        <motion.div className={cardClassName} {...motionVariants}>
          <TransactionFeed />
        </motion.div>
      </motion.div>

      <motion.div
        className="dark:bg-polar-800 rounded-4xl bg-gray-50 p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.3 } }}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg">Quick Actions</span>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full border-none"
            onClick={() => handleSandboxAction('Settings')}
          >
            <Settings className="mr-1.5 h-4 w-4" />
            Settings
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickActionButton
            icon={Plus}
            label="Add Funds"
            variant="emerald"
            onClick={() => handleSandboxAction('Add Funds')}
          />
          <QuickActionButton
            icon={ArrowUpRight}
            label="Transfer"
            variant="blue"
            onClick={() => handleSandboxAction('Transfer')}
          />
          <QuickActionButton
            icon={CreditCard}
            label="New Card"
            variant="purple"
            onClick={() => handleSandboxAction('New Card')}
          />
        </div>
      </motion.div>
    </DashboardBody>
  )
}
