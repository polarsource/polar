import { useTransactionsSummary } from '@/hooks/queries'
import { usePayoutAccountSetup } from '@/hooks/usePayoutAccountSetup'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'

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
    payoutAccount,
    hasReusableAccounts,
    openCreate,
    openManage,
    modals: payoutAccountModals,
  } = usePayoutAccountSetup(
    organization,
    `/dashboard/${organization.slug}/finance/payouts`,
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

  const availableBalance = summary
    ? formatCurrency('accounting')(
        summary.available_balance.amount,
        summary.available_balance.currency,
      )
    : null

  return (
    <Box flexDirection={{ base: 'column', md: 'row' }} gap="2xl">
      <Well className="flex-1 justify-start rounded-2xl bg-gray-50 p-6">
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
        </WellContent>
        <WellFooter>
          {summary &&
          summary.available_balance.amount !== summary.balance.amount ? (
            <Text color="muted">
              Held balance:{' '}
              {formatCurrency('accounting')(
                summary.balance.amount - summary.available_balance.amount,
                summary.balance.currency,
              )}
            </Text>
          ) : null}
        </WellFooter>
      </Well>
      <Well className="flex-1 justify-start rounded-2xl bg-gray-50 p-6">
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
        <WellFooter className="mt-auto">
          <Text color="muted">
            Fees are first deducted from available credits.
          </Text>
        </WellFooter>
      </Well>
      <Well className="flex-1 justify-start rounded-2xl bg-gray-50 p-6">
        <WellHeader className="flex flex-row items-center justify-between gap-x-6">
          <Text variant="heading-xxs" as="h2">
            Payout Account
          </Text>
          {payoutAccount || hasReusableAccounts ? (
            <Button
              className="self-start"
              variant="secondary"
              onClick={openManage}
            >
              Manage
            </Button>
          ) : (
            <Button className="self-start" onClick={openCreate}>
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
        <WellFooter className="mt-auto">
          {payoutAccount ? (
            <Box alignItems="center" columnGap="m">
              <Text color="muted">
                {payoutAccount.country.toUpperCase()} ·{' '}
                {payoutAccount.currency.toUpperCase()}
              </Text>
              <Box display="inline-flex" alignItems="center" columnGap="xs">
                <Box
                  display="block"
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
      {payoutAccountModals}
    </Box>
  )
}

export default AccountBalance
