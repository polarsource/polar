import { useAccountCredits, useTransactionsSummary } from '@/hooks/queries'
import { Skeleton } from '@mui/material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import React, { useCallback, useState } from 'react'
import WithdrawModal from './WithdrawModal'

interface AccountBalanceProps {
  account: schemas['Account']
  organization: schemas['Organization']
  onWithdrawSuccess?: (payoutId: string) => void
}

const AccountBalance: React.FC<AccountBalanceProps> = ({
  account,
  organization,
  onWithdrawSuccess: _onWithdrawSuccess,
}) => {
  const {
    data: summary,
    refetch: refetchBalance,
    isLoading,
  } = useTransactionsSummary(account.id)

  const hasCredits = account.credit_balance > 0
  const { data: credits, isLoading: isLoadingCredits } = useAccountCredits(
    hasCredits ? account.id : undefined,
  )

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
              {isLoading ? (
                <Skeleton />
              ) : (
                <>
                  {summary &&
                    formatCurrencyAndAmount(
                      summary.balance.amount,
                      summary.balance.currency,
                    )}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button onClick={onWithdraw}>Withdraw</Button>
            <p className="dark:text-polar-500 text-xs text-gray-500">
              Minimum {formatCurrencyAndAmount(1000, 'usd', 0)}
            </p>
          </div>
        </div>
        {hasCredits && !isLoadingCredits && credits && credits.length > 0 && (
          <div className="mt-6">
            {credits.map((credit, index) => (
              <div
                key={credit.id}
                className={`flex items-center justify-between py-3 ${
                  index > 0 ? 'border-t dark:border-polar-700' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>🎉</span>
                  <span className="font-medium">{credit.title}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium">
                    {formatCurrencyAndAmount(credit.amount, 'usd')} Credits
                  </span>
                  <span className="dark:text-polar-400 text-xs text-gray-500">
                    {formatCurrencyAndAmount(credit.used, 'usd')} used
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ShadowBoxOnMd>
      <WithdrawModal
        account={account}
        organization={organization}
        isShown={showConfirmModal}
        hide={() => setShowConfirmModal(false)}
        onSuccess={onWithdrawSuccess}
      />
    </>
  )
}

export default AccountBalance
