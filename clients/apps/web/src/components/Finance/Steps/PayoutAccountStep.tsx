'use client'

import { usePayoutAccountSetup } from '@/hooks/usePayoutAccountSetup'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { ArrowRight, CheckIcon, ExternalLink } from 'lucide-react'
import { useCallback, useState } from 'react'

interface PayoutAccountStepProps {
  organization: schemas['Organization']
}

export default function PayoutAccountStep({
  organization,
}: PayoutAccountStepProps) {
  const returnPath = `/dashboard/${organization.slug}/finance/account`
  const { payoutAccount, openPrimary, modals } = usePayoutAccountSetup(
    organization,
    returnPath,
  )

  const isAccountSetupComplete = payoutAccount && payoutAccount.is_payout_ready

  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)

  const handleStartAccountSetup = useCallback(async () => {
    if (!payoutAccount) {
      openPrimary()
    } else {
      const link = await unwrap(
        api.POST('/v1/payout-accounts/{id}/onboarding-link', {
          params: {
            path: {
              id: payoutAccount.id,
            },
            query: {
              return_path: returnPath,
            },
          },
        }),
      )
      window.location.href = link.url
    }
  }, [payoutAccount, returnPath, openPrimary])

  const handleOpenStripeDashboard = useCallback(async () => {
    if (!payoutAccount) return
    setIsLoadingDashboard(true)
    try {
      const link = await unwrap(
        api.POST('/v1/payout-accounts/{id}/dashboard-link', {
          params: { path: { id: payoutAccount.id } },
        }),
      )
      window.open(link.url, '_blank')
    } finally {
      setIsLoadingDashboard(false)
    }
  }, [payoutAccount])

  if (isAccountSetupComplete) {
    const isStripe = payoutAccount.type === 'stripe'

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

  return (
    <>
      <div className="dark:bg-polar-800 rounded-2xl border bg-white p-8 text-center">
        <h4 className="mb-2 font-medium">Connect payout account</h4>
        <p className="dark:text-polar-400 mx-auto mb-6 max-w-sm text-sm text-balance text-gray-600">
          Connect or create a Stripe account to receive payments from your
          customers.
        </p>
        <Button onClick={handleStartAccountSetup} className="w-auto">
          Continue with Account Setup
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      {modals}
    </>
  )
}
