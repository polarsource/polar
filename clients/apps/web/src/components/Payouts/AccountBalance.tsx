import { usePayoutAccount } from '@/hooks/queries/payout_accounts'
import { useTransactionsSummary } from '@/hooks/queries'
import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import { Modal } from '@/components/Modal'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import React, { useCallback } from 'react'
import { useModal } from '../Modal/useModal'
import { Well, WellContent, WellFooter, WellHeader } from '../Shared/Well'
import { FeeCreditGrantsModal } from './FeeCreditGrantsModal'
import ManagePayoutAccountModal from './ManagePayoutAccountModal'
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

  const { data: payoutAccount } = usePayoutAccount(
    organization.payout_account_id ?? undefined,
  )

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
  const {
    isShown: isCreatePayoutAccountModalShown,
    show: showCreatePayoutAccountModal,
    hide: hideCreatePayoutAccountModal,
  } = useModal(false)
  const {
    isShown: isManagePayoutAccountModalShown,
    show: showManagePayoutAccountModal,
    hide: hideManagePayoutAccountModal,
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

  const handleCreateNew = useCallback(() => {
    hideManagePayoutAccountModal()
    showCreatePayoutAccountModal()
  }, [hideManagePayoutAccountModal, showCreatePayoutAccountModal])

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
              <div className="animate-pulse rounded-lg bg-gray-200 text-gray-200">
                &nbps;
              </div>
            ) : (
              summary &&
              formatCurrency('accounting')(
                summary.balance.amount,
                summary.balance.currency,
              )
            )}
          </div>
        </WellContent>
        <WellFooter>
          <p className="dark:text-polar-500 text-gray-500">
            Minimum withdrawal amounts apply.
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
              <div className="animate-pulse rounded-lg bg-gray-200 text-gray-200">
                &nbps;
              </div>
            ) : (
              summary &&
              formatCurrency('accounting')(account.credit_balance, 'usd')
            )}
          </div>
        </WellContent>
        <WellFooter>
          <p className="dark:text-polar-500 text-gray-500">
            Fees are first deducted from available credits.
          </p>
        </WellFooter>
      </Well>
      <Well className="flex-1 justify-between rounded-2xl bg-gray-50 p-6">
        <WellHeader className="flex flex-row items-center justify-between gap-x-6">
          <h2 className="text-lg font-medium capitalize">Payout Account</h2>
          {payoutAccount ? (
            <Button
              className="self-start"
              variant="secondary"
              onClick={showManagePayoutAccountModal}
            >
              Manage
            </Button>
          ) : (
            <Button
              className="self-start"
              onClick={showCreatePayoutAccountModal}
            >
              Create
            </Button>
          )}
        </WellHeader>
        <WellContent>
          {payoutAccount ? (
            <p className="text-4xl capitalize">{payoutAccount.type}</p>
          ) : (
            <p className="dark:text-polar-700 text-4xl text-gray-300">—</p>
          )}
        </WellContent>
        <WellFooter>
          {payoutAccount ? (
            <div className="flex items-center gap-x-3">
              <p className="dark:text-polar-500 text-gray-500">
                {payoutAccount.country.toUpperCase()} ·{' '}
                {payoutAccount.currency.toUpperCase()}
              </p>
              <span
                className={`inline-flex items-center gap-x-1.5 text-xs ${
                  payoutAccount.is_payout_ready
                    ? 'text-green-600 dark:text-green-500'
                    : 'text-yellow-600 dark:text-yellow-500'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    payoutAccount.is_payout_ready
                      ? 'bg-green-600 dark:bg-green-500'
                      : 'bg-yellow-600 dark:bg-yellow-500'
                  }`}
                />
                {payoutAccount.is_payout_ready ? 'Ready' : 'Setup required'}
              </span>
            </div>
          ) : (
            <p className="dark:text-polar-500 text-gray-500">
              No payout account configured.
            </p>
          )}
        </WellFooter>
      </Well>
      <WithdrawModal
        organization={organization}
        account={account}
        isShown={isPayoutConfirmModalShown}
        hide={hidePayoutConfirmModal}
        onSuccess={onWithdrawSuccess}
      />
      <FeeCreditGrantsModal
        isShown={isCreditGrantsModalShown}
        hide={hideCreditGrantsModal}
      />
      <Modal
        title="Create Payout Account"
        isShown={isCreatePayoutAccountModalShown}
        className="min-w-100"
        hide={hideCreatePayoutAccountModal}
        modalContent={
          <AccountCreateModal
            forOrganizationId={organization.id}
            returnPath={`/dashboard/${organization.slug}/finance/payouts`}
          />
        }
      />
      <Modal
        title="Manage Payout Accounts"
        isShown={isManagePayoutAccountModalShown}
        className="min-w-[560px]"
        hide={hideManagePayoutAccountModal}
        modalContent={
          <ManagePayoutAccountModal
            organization={organization}
            onCreateNew={handleCreateNew}
          />
        }
      />
    </div>
  )
}

export default AccountBalance
