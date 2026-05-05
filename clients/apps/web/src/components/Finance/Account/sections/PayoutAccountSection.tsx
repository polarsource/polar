'use client'

import PayoutAccountStep from '@/components/Finance/Steps/PayoutAccountStep'
import { usePayoutAccount } from '@/hooks/queries/payout_accounts'
import { schemas } from '@polar-sh/client'

interface Props {
  organization: schemas['Organization']
}

export const PayoutAccountSection = ({ organization }: Props) => {
  const { data: payoutAccount } = usePayoutAccount(
    organization.payout_account_id || undefined,
  )

  return (
    <PayoutAccountStep
      organization={organization}
      payoutAccount={payoutAccount}
    />
  )
}
