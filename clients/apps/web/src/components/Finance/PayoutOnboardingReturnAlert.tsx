'use client'

import {
  usePayoutAccount,
  useSyncPayoutAccount,
} from '@/hooks/queries/payout_accounts'
import { schemas } from '@polar-sh/client'
import { Alert } from '@polar-sh/orbit'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getPayoutAccountPresentation } from './payoutAccountPresentation'
import {
  PAYOUT_ONBOARDING_ACCOUNT_PARAM,
  PAYOUT_ONBOARDING_RETURN_PARAM,
} from './payoutOnboardingReturn'

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

  const [visible, setVisible] = useState(isReturn)
  // Read once: clearing the marker drops it from the URL.
  const [returnedAccountId] = useState(
    () => searchParams.get(PAYOUT_ONBOARDING_ACCOUNT_PARAM) ?? undefined,
  )
  const payoutAccountId =
    returnedAccountId ?? organization.payout_account_id ?? undefined

  const syncedRef = useRef(false)

  const { data: payoutAccount } = usePayoutAccount(payoutAccountId)
  const syncPayoutAccount = useSyncPayoutAccount(payoutAccountId ?? '')

  // Only clear the marker once the sync succeeded — a failed sync must not leave the
  // page claiming a status we never confirmed.
  const sync = useCallback(() => {
    syncPayoutAccount.mutate(undefined, {
      onSuccess: () => router.replace(pathname),
    })
  }, [syncPayoutAccount, router, pathname])

  useEffect(() => {
    if (!isReturn || !payoutAccountId || syncedRef.current) return
    syncedRef.current = true
    sync()
  }, [isReturn, payoutAccountId, sync])

  if (!visible || !payoutAccountId) {
    return null
  }

  if (syncPayoutAccount.isPending) {
    return (
      <Alert
        variant="info"
        loading
        title="Checking with Stripe"
        description="One moment while we confirm your payout account."
      />
    )
  }

  if (syncPayoutAccount.isError) {
    return (
      <Alert
        variant="warning"
        title="Could not confirm with Stripe"
        description="We couldn't check your payout account just now. Your setup may still have gone through."
        actions={[{ text: 'Try again', onClick: sync }]}
        onDismiss={() => setVisible(false)}
      />
    )
  }

  if (!payoutAccount) {
    return null
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
