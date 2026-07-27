'use client'

import { toast } from '@/components/Toast/use-toast'
import { useSyncPayoutAccount } from '@/hooks/queries/payout_accounts'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { RefreshCwIcon } from 'lucide-react'
import { useCallback } from 'react'

interface Props {
  payoutAccount: schemas['PayoutAccount']
  variant?: 'default' | 'ghost'
}

export const CheckPayoutStatusButton = ({
  payoutAccount,
  variant = 'ghost',
}: Props) => {
  const syncPayoutAccount = useSyncPayoutAccount(payoutAccount.id)

  const checkStatus = useCallback(async () => {
    try {
      const synced = await syncPayoutAccount.mutateAsync()
      if (synced.status === payoutAccount.status) {
        toast({
          title: 'No change yet',
          description: 'Stripe has not updated this account since last time.',
        })
      }
    } catch {
      toast({
        title: 'Could not reach Stripe',
        description: 'Please try again in a moment.',
      })
    }
  }, [syncPayoutAccount, payoutAccount.status])

  return (
    <Button
      variant={variant}
      size={variant === 'ghost' ? 'sm' : undefined}
      onClick={checkStatus}
      loading={syncPayoutAccount.isPending}
    >
      <RefreshCwIcon className="mr-2 h-4 w-4" />
      Check status
    </Button>
  )
}
