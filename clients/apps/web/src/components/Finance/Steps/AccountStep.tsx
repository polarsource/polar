'use client'

import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ArrowRight, Building2, ShieldAlert } from 'lucide-react'
import React from 'react'

interface AccountStepProps {
  organizationAccount?: schemas['Account']
  isNotAdmin: boolean
  onStartAccountSetup: () => void
  onSkipAccountSetup?: () => void
}

export default function AccountStep({
  organizationAccount,
  isNotAdmin,
  onStartAccountSetup,
  onSkipAccountSetup,
}: AccountStepProps) {
  const isAccountSetupComplete =
    organizationAccount?.stripe_id !== null &&
    organizationAccount?.is_details_submitted &&
    organizationAccount?.is_charges_enabled &&
    organizationAccount?.is_payouts_enabled

  if (isAccountSetupComplete) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
          <Building2 className="h-6 w-6 text-emerald-500" />
        </div>
        <div>
          <h3 className="font-medium dark:text-white">
            Payout account connected
          </h3>
          <p className="dark:text-polar-400 mt-1 text-sm text-gray-500">
            Your account is configured and ready to receive payouts.
          </p>
        </div>
      </div>
    )
  }

  if (isNotAdmin) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
          <ShieldAlert className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <h3 className="font-medium dark:text-white">Admin required</h3>
          <p className="dark:text-polar-400 mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Only the account admin can connect a payout account. You can skip
            this step and continue with identity verification.
          </p>
        </div>
        {onSkipAccountSetup && (
          <Button onClick={onSkipAccountSetup} className="mt-2">
            Skip & Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
        <Building2 className="h-6 w-6 text-blue-500" />
      </div>
      <div>
        <h3 className="font-medium dark:text-white">
          Connect your payout account
        </h3>
        <p className="dark:text-polar-400 mx-auto mt-1 max-w-sm text-sm text-gray-500">
          Connect your bank account so Spaire can send you your earnings.
          You&apos;ll be redirected to Stripe to complete this step.
        </p>
      </div>
      <Button onClick={onStartAccountSetup} className="mt-2">
        Connect Account
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}
