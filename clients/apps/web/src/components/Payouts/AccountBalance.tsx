import { useTransactionsSummary } from '@/hooks/queries'
import { Skeleton } from '@mui/material'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import React, { useCallback } from 'react'
import { useModal } from '../Modal/useModal'
import { Well, WellContent, WellFooter, WellHeader } from '../Shared/Well'
import { FeeCreditGrantsModal } from './FeeCreditGrantsModal'
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

  const {
    isShown: isPayoutConfirmModalShown,
    show: showPayoutConfirmModal,
    hide: hidePayoutConfirmModal,
  } = useModal(false)
  const {
    isShown: isCreditGrantsModalShown,
    show: showCreditGrantsModal,
    hide: hideCreditGrantsModal,
  } = useModal(false)

  const onWithdrawSuccess = useCallback(
    (payoutId: string) => {
      refetchBalance()
      hidePayoutConfirmModal()
      if (_onWithdrawSuccess) {
        _onWithdrawSuccess(payoutId)
      }
    },
    [_onWithdrawSuccess, refetchBalance, hidePayoutConfirmModal],
  )

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <Well className="flex-1 justify-between rounded-2xl bg-gray-50 p-6">
        <WellHeader className="flex flex-row items-center justify-between gap-x-6">
          <h2 className="text-lg font-medium capitalize">Balance</h2>
          <Button className="self-start" onClick={showPayoutConfirmModal}>
            Withdraw
          </Button>
        </WellHeader>
        <WellContent>
          <div className="text-4xl">
            {isLoading ? (
              <Skeleton />
            ) : (
              <>
                {summary &&
                  formatCurrency('accounting')(
                    summary.balance.amount,
                    summary.balance.currency,
                  )}
              </>
            )}
          </div>
        </WellContent>
        <WellFooter>
          <p className="dark:text-polar-500 text-gray-500">
            You may only withdraw funds above $10.
          </p>
        </WellFooter>
      </Well>
      <Well className="flex-1 justify-between rounded-2xl bg-gray-50 p-6">
        <WellHeader className="flex flex-row items-center justify-between gap-x-6">
          <h2 className="text-lg font-medium capitalize">Fee Credits</h2>
          <Button
            className="self-start"
            variant="secondary"
            onClick={showCreditGrantsModal}
          >
            View Grants
          </Button>
        </WellHeader>
        <WellContent>
          <div className="text-4xl">
            {isLoading ? (
              <Skeleton />
            ) : (
              <>
                {summary &&
                  formatCurrency('accounting')(account.credit_balance, 'usd')}
              </>
            )}
          </div>
        </WellContent>
        <WellFooter>
          <p className="dark:text-polar-500 text-gray-500">
            Fees are first deducted from any available credits.
          </p>
        </WellFooter>
      </Well>
      <WithdrawModal
        account={account}
        organization={organization}
        isShown={isPayoutConfirmModalShown}
        hide={hidePayoutConfirmModal}
        onSuccess={onWithdrawSuccess}
      />
      <FeeCreditGrantsModal
        isShown={isCreditGrantsModalShown}
        hide={hideCreditGrantsModal}
      />
    </div>
  )
}

export default AccountBalance
