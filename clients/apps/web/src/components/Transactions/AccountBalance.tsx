import { Account, Status } from '@polar-sh/sdk'
import { Button, ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { useTransactionsSummary } from 'polarkit/hooks'
import { getCentsInDollarString } from 'polarkit/money'
import React, { useCallback, useState } from 'react'
import WithdrawModal from './WithdrawModal'

interface AccountBalanceProps {
  account: Account
  onWithdrawSuccess?: (payoutId: string) => void
}

const AccountBalance: React.FC<AccountBalanceProps> = ({
  account,
  onWithdrawSuccess: _onWithdrawSuccess,
}) => {
  const { data: summary, refetch: refetchBalance } = useTransactionsSummary(
    account.id,
  )
  const canWithdraw =
    (account.status === Status.UNREVIEWED ||
      account.status === Status.ACTIVE) &&
    summary?.balance?.amount &&
    summary.balance.amount > 0

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const onWithdraw = useCallback(() => {
    setShowConfirmModal(true)
  }, [])

  const onWithdrawSuccess = useCallback(
    (payoutId: string) => {
      refetchBalance()
      setShowConfirmModal(false)
      if (_onWithdrawSuccess) {
        _onWithdrawSuccess(payoutId)
      }
    },
    [_onWithdrawSuccess, refetchBalance],
  )

  return (
    <>
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
            <Button onClick={onWithdraw} disabled={!canWithdraw}>
              Withdraw
            </Button>
          </div>
        </div>
      </ShadowBoxOnMd>
      <WithdrawModal
        account={account}
        isShown={showConfirmModal}
        hide={() => setShowConfirmModal(false)}
        onSuccess={onWithdrawSuccess}
      />
    </>
  )
}

export default AccountBalance
