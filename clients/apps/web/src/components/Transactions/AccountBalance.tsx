import { Account, Status } from '@polar-sh/sdk'
import { api } from 'polarkit'
import { Button, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { useTransactionsSummary } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import React, { useCallback, useState } from 'react'

interface AccountBalanceProps {
  account: Account
  onWithdrawSuccess?: (payoutId: string) => void
}

const AccountBalance: React.FC<AccountBalanceProps> = ({
  account,
  onWithdrawSuccess,
}) => {
  const { data: summary, refetch: refetchBalance } = useTransactionsSummary(
    account.id,
  )
  const canWithdraw =
    (account.status === Status.UNREVIEWED ||
      account.status === Status.ACTIVE) &&
    summary?.balance?.amount &&
    summary.balance.amount > 0
  const [loading, setLoading] = useState(false)

  const onWithdraw = useCallback(async () => {
    setLoading(true)
    try {
      const { id } = await api.transactions.createPayout({
        payoutCreate: { account_id: account.id },
      })
      await refetchBalance()
      if (onWithdrawSuccess) {
        onWithdrawSuccess(id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [account.id, refetchBalance, onWithdrawSuccess])

  return (
    <ShadowBoxOnMd>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-y-2">
          <h2 className="text-lg font-medium capitalize">Balance</h2>
          <div className="text-4xl">
            {
              <>
                $
                {getCentsInDollarString(
                  summary?.balance.amount ?? 0,
                  true,
                  true,
                )}
              </>
            }
          </div>
        </div>
        <div>
          <Button
            onClick={onWithdraw}
            disabled={!canWithdraw}
            loading={loading}
          >
            Withdraw
          </Button>
        </div>
      </div>
    </ShadowBoxOnMd>
  )
}

export default AccountBalance
