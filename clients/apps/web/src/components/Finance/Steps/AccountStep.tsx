'use client'

import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Card } from '@polar-sh/ui/components/ui/card'
import { ArrowRight, UserCheck } from 'lucide-react'
import React from 'react'

interface AccountStepProps {
  organizationAccount?: schemas['Account']
  isNotAdmin: boolean
  onStartAccountSetup: () => void
}

const StepCard = ({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) => <Card className={`p-6 ${className}`}>{children}</Card>

export default function AccountStep({
  organizationAccount,
  isNotAdmin,
  onStartAccountSetup,
}: AccountStepProps) {
  const isAccountSetupComplete =
    organizationAccount?.stripe_id !== null &&
    organizationAccount?.is_details_submitted &&
    organizationAccount?.is_charges_enabled &&
    organizationAccount?.is_payouts_enabled

  if (isAccountSetupComplete) {
    return (
      <div className="dark:bg-polar-800 rounded-2xl border bg-white p-8 text-center">
        <h4 className="mb-2 font-medium">Account setup complete</h4>
        <p className="dark:text-polar-400 text-sm text-gray-600">
          Your payout account is configured and ready.
        </p>
      </div>
    )
  }

  if (isNotAdmin) {
    return (
      <div className="dark:bg-polar-800 rounded-2xl border bg-white p-8 text-center">
        <div className="dark:bg-polar-800 dark:border-polar-600 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8">
          <div className="mb-4 flex justify-center">
            <div className="dark:bg-polar-700 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
              <UserCheck className="dark:text-polar-400 h-6 w-6 text-gray-500" />
            </div>
          </div>
          <h4 className="dark:text-polar-400 mb-2 font-medium text-gray-600">
            Account Setup Restricted
          </h4>
          <p className="dark:text-polar-500 mx-auto mb-4 max-w-md text-sm text-gray-500">
            You are not the admin of the account. Only the account admin can set
            up payout accounts.
          </p>
          <p className="dark:text-polar-400 mt-3 text-xs text-gray-500">
            The account admin will need to complete this step separately
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="dark:bg-polar-800 rounded-2xl border bg-white p-8 text-center">
      <h4 className="mb-2 font-medium">Connect payout account</h4>
      <p className="dark:text-polar-400 mx-auto mb-6 max-w-sm text-sm text-pretty text-gray-600">
        Connect or create a Stripe account to receive payments from your
        customers.
      </p>
      <Button onClick={onStartAccountSetup} className="w-auto">
        Continue with Account Setup
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}
