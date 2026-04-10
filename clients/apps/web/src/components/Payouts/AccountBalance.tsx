import { usePayoutAccount, useDeletePayoutAccount } from '@/hooks/queries/payout_accounts'
import { useTransactionsSummary } from '@/hooks/queries'
import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { Modal } from '@/components/Modal'
import { toast } from '@/components/Toast/use-toast'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ExternalLink, Trash2 } from 'lucide-react'
import React, { useCallback, useState } from 'react'
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

  const { data: payoutAccount } = usePayoutAccount(
    organization.payout_account_id ?? undefined,
  )

  const deletePayoutAccount = useDeletePayoutAccount()

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
    isShown: isDeletePayoutAccountModalShown,
    show: showDeletePayoutAccountModal,
    hide: hideDeletePayoutAccountModal,
  } = useModal(false)

  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)

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
    } catch {
      toast({
        title: 'Failed to open Stripe dashboard',
        description: 'An error occurred while generating the dashboard link.',
      })
    } finally {
      setIsLoadingDashboard(false)
    }
  }, [payoutAccount])

  const handleDeletePayoutAccount = useCallback(async () => {
    if (!payoutAccount) return
    const { error } = await deletePayoutAccount.mutateAsync(payoutAccount.id)
    if (error) {
      toast({
        title: 'Failed to delete payout account',
        description:
          typeof error.detail === 'string'
            ? error.detail
            : 'An error occurred while deleting the payout account.',
      })
    } else {
      toast({
        title: 'Payout account deleted',
        description: 'Your payout account has been successfully deleted.',
      })
    }
  }, [payoutAccount, deletePayoutAccount])

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
            Fees are first deducted from any available credits.
          </p>
        </WellFooter>
      </Well>
      <Well className="flex-1 justify-between rounded-2xl bg-gray-50 p-6">
        <WellHeader className="flex flex-row items-center justify-between gap-x-6">
          <h2 className="text-lg font-medium capitalize">Payout Account</h2>
        </WellHeader>
        <WellContent>
          {payoutAccount ? (
            <div className="flex flex-col gap-y-3">
              <p className="text-lg capitalize">{payoutAccount.type}</p>
              <div className="flex flex-row flex-wrap gap-2">
                {payoutAccount.type === 'stripe' && (
                  <Button
                    variant="secondary"
                    onClick={handleOpenStripeDashboard}
                    loading={isLoadingDashboard}
                    size="sm"
                  >
                    Open in Stripe
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={showDeletePayoutAccountModal}
                  size="sm"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <p className="dark:text-polar-500 text-gray-500">
              No payout account configured.
            </p>
          )}
        </WellContent>
        <WellFooter>
          {!payoutAccount && (
            <Button
              className="self-start"
              onClick={showCreatePayoutAccountModal}
            >
              Create Payout Account
            </Button>
          )}
        </WellFooter>
      </Well>
      <WithdrawModal
        organization={organization}
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
      <ConfirmModal
        title="Delete Payout Account"
        description="Are you sure you want to delete your payout account? This action cannot be undone."
        destructive
        destructiveText="Delete"
        onConfirm={handleDeletePayoutAccount}
        isShown={isDeletePayoutAccountModalShown}
        hide={hideDeletePayoutAccountModal}
      />
    </div>
  )
}

export default AccountBalance
