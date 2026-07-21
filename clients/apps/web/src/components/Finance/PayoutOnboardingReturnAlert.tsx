'use client'

import {
  usePayoutAccount,
  useSyncPayoutAccount,
} from '@/hooks/queries/payout_accounts'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { getPayoutAccountPresentation } from './payoutAccountPresentation'
import { PAYOUT_ONBOARDING_RETURN_PARAM } from './payoutOnboardingReturn'

const ALERT_VARIANTS = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  pending: 'info',
  neutral: 'info',
} as const

interface Props {
  organization: schemas['Organization']
}

export const PayoutOnboardingReturnAlert = ({ organization }: Props) => {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isReturn = searchParams.get(PAYOUT_ONBOARDING_RETURN_PARAM) === 'return'
  const payoutAccountId = organization.payout_account_id ?? undefined

  const [visible, setVisible] = useState(isReturn)
  const syncedRef = useRef(false)

  const { data: payoutAccount } = usePayoutAccount(payoutAccountId)
  const syncPayoutAccount = useSyncPayoutAccount(payoutAccountId ?? '')

  useEffect(() => {
    if (!isReturn || !payoutAccountId || syncedRef.current) return
    syncedRef.current = true
    // Stripe decides on its own schedule, so read the account back rather than
    // waiting on the `account.updated` webhook.
    syncPayoutAccount.mutate(undefined, {
      onSettled: () => router.replace(pathname),
    })
  }, [isReturn, payoutAccountId, syncPayoutAccount, router, pathname])

  if (!visible || !payoutAccountId) {
    return null
  }

  if (syncPayoutAccount.isPending || !payoutAccount) {
    return (
      <Alert
        variant="info"
        loading
        title="Checking with Stripe"
        description="One moment while we confirm your payout account."
      />
    )
  }

  const { tone, title, description } =
    getPayoutAccountPresentation(payoutAccount)

  return (
    <Alert
      variant={ALERT_VARIANTS[tone]}
      title={title}
      description={description}
      onDismiss={() => setVisible(false)}
    />
  )
}
