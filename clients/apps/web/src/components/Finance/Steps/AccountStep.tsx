'use client'

import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ArrowRight, CheckIcon, ExternalLink, UserCheck } from 'lucide-react'
import { useCallback, useState } from 'react'

interface AccountStepProps {
  organizationAccount?: schemas['Account']
  isNotAdmin: boolean
  onStartAccountSetup: () => void
}

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

  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)

  const handleOpenStripeDashboard = useCallback(async () => {
    if (!organizationAccount) return
    setIsLoadingDashboard(true)
    try {
      const link = await unwrap(
        api.POST('/v1/accounts/{id}/dashboard_link', {
          params: { path: { id: organizationAccount.id } },
        }),
      )
      window.open(link.url, '_blank')
    } finally {
      setIsLoadingDashboard(false)
    }
  }, [organizationAccount])

  if (isAccountSetupComplete) {
    const isStripe = organizationAccount?.stripe_id !== null

    if (isStripe) {
      return (
        <div className="dark:bg-polar-800 rounded-2xl border bg-white p-8 text-center">
          <span className="dark:bg-polar-700 mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
            <CheckIcon className="dark:text-polar-400 h-4 w-4 text-gray-500" />
          </span>
          <h4 className="mb-2 font-medium">Account setup complete</h4>
          <p className="dark:text-polar-400 mx-auto mb-6 max-w-sm text-sm text-balance text-gray-600">
            Your Stripe payout account is configured and ready to receive
            payouts.
          </p>
          <Button
            onClick={handleOpenStripeDashboard}
            loading={isLoadingDashboard}
            className="w-auto"
          >
            Open in Stripe
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )
    }

    return (
      <div className="dark:bg-polar-800 rounded-2xl border bg-white p-8 text-center">
        <h4 className="mb-2 font-medium">Manual payouts</h4>
        <p className="dark:text-polar-400 mx-auto max-w-sm text-sm text-balance text-gray-600">
          You&apos;re receiving manual payouts.{' '}
          <a
            href="mailto:support@polar.sh"
            className="underline hover:no-underline"
          >
            Reach out to support
          </a>{' '}
          to request a payout or change this.
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
      <p className="dark:text-polar-400 mx-auto mb-6 max-w-sm text-sm text-balance text-gray-600">
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
