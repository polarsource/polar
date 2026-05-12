import { usePayoutAccount } from '@/hooks/queries/payout_accounts'
import { useTransactionsSummary } from '@/hooks/queries'
import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import { Modal } from '@/components/Modal'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'

import { ISODuration } from '@/utils/duration'
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

  const delay = new ISODuration(account.payout_transaction_delay)
  const hasDelay = delay.isNonZero()
  const delayLabel = delay.format()
  const availableBalance = summary
    ? formatCurrency('accounting')(
        summary.available_balance.amount,
        summary.available_balance.currency,
      )
    : null
  const totalBalance = summary
    ? formatCurrency('accounting')(
        summary.balance.amount,
        summary.balance.currency,
      )
    : null

  return (
    <Box display="flex" flexDirection={{ base: 'column', md: 'row' }} gap="2xl">
      <Well className="flex-1 justify-between rounded-2xl bg-gray-50 p-6">
        <WellHeader className="flex flex-row items-center justify-between gap-x-6">
          <Text variant="heading-xxs" as="h2">
            Available balance
          </Text>
          <Button className="self-start" onClick={showPayoutConfirmModal}>
            Withdraw
          </Button>
        </WellHeader>
        <WellContent>
          <Text variant="heading-s" loading={isLoading}>
            {availableBalance}
          </Text>
          {summary &&
          summary.available_balance.amount !== summary.balance.amount ? (
            <Box display="flex" flexDirection="column" rowGap="xs">
              <Text color="muted">Total balance: {totalBalance}</Text>
              {hasDelay && (
                <Text color="muted">
                  Available in {delayLabel}:{' '}
                  {formatCurrency('accounting')(
                    summary.balance.amount - summary.available_balance.amount,
                    summary.balance.currency,
                  )}
                </Text>
              )}
            </Box>
          ) : null}
        </WellContent>
        <WellFooter>
          <Text color="muted">Minimum withdrawal amounts apply.</Text>
        </WellFooter>
      </Well>
      <Well className="flex-1 justify-between rounded-2xl bg-gray-50 p-6">
        <WellHeader className="flex flex-row items-center justify-between gap-x-6">
          <Text variant="heading-xxs" as="h2">
            Fee Credits
          </Text>
          <Button
            className="self-start"
            variant="secondary"
            onClick={showCreditGrantsModal}
          >
            View Grants
          </Button>
        </WellHeader>
        <WellContent>
          <Text variant="heading-s" loading={isLoading}>
            {summary &&
              formatCurrency('accounting')(account.credit_balance, 'usd')}
          </Text>
        </WellContent>
        <WellFooter>
          <Text color="muted">
            Fees are first deducted from available credits.
          </Text>
        </WellFooter>
      </Well>
      <Well className="flex-1 justify-between rounded-2xl bg-gray-50 p-6">
        <WellHeader className="flex flex-row items-center justify-between gap-x-6">
          <Text variant="heading-xxs" as="h2">
            Payout Account
          </Text>
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
          <Text
            variant="heading-s"
            color={payoutAccount ? 'default' : 'disabled'}
            loading={!payoutAccount && organization.payout_account_id != null}
          >
            {payoutAccount
              ? payoutAccount.type[0].toUpperCase() +
                payoutAccount.type.slice(1)
              : '—'}
          </Text>
        </WellContent>
        <WellFooter>
          {payoutAccount ? (
            <Box display="flex" alignItems="center" columnGap="m">
              <Text color="muted">
                {payoutAccount.country.toUpperCase()} ·{' '}
                {payoutAccount.currency.toUpperCase()}
              </Text>
              <Box display="inline-flex" alignItems="center" columnGap="xs">
                <Box
                  width={6}
                  height={6}
                  borderRadius="full"
                  backgroundColor={
                    payoutAccount.is_payout_ready
                      ? 'background-success'
                      : 'background-warning'
                  }
                />
                <Text
                  variant="caption"
                  color={payoutAccount.is_payout_ready ? 'success' : 'warning'}
                >
                  {payoutAccount.is_payout_ready ? 'Ready' : 'Setup required'}
                </Text>
              </Box>
            </Box>
          ) : (
            <Text color="muted">No payout account configured.</Text>
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
    </Box>
  )
}

export default AccountBalance
