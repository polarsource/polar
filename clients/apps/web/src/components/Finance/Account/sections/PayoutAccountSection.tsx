'use client'

import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import ManagePayoutAccountModal from '@/components/Payouts/ManagePayoutAccountModal'
import { useOrganization } from '@/hooks/queries'
import {
  usePayoutAccount,
  usePayoutAccounts,
} from '@/hooks/queries/payout_accounts'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ArrowRight, BanknoteIcon, CheckIcon } from 'lucide-react'
import { useCallback } from 'react'
import { StatusBlock } from './StatusBlock'

interface Props {
  organization: schemas['Organization']
}

export const PayoutAccountSection = ({ organization: initialOrg }: Props) => {
  const { data: organization = initialOrg } = useOrganization(
    initialOrg.id,
    true,
    initialOrg,
  )
  const { data: payoutAccount } = usePayoutAccount(
    organization.payout_account_id || undefined,
  )
  const { data: payoutAccountsList } = usePayoutAccounts()
  const hasReusableAccounts = (payoutAccountsList?.items?.length ?? 0) > 0
  const isStripeAccount = payoutAccount?.type === 'stripe'
  const isManualAccount = payoutAccount && !isStripeAccount

  const {
    isShown: isShownCreateModal,
    show: showCreateModal,
    hide: hideCreateModal,
  } = useModal()
  const {
    isShown: isShownManageModal,
    show: showManageModal,
    hide: hideManageModal,
  } = useModal()

  const handleCreateFromManage = useCallback(() => {
    hideManageModal()
    showCreateModal()
  }, [hideManageModal, showCreateModal])

  const manageModal = (
    <Modal
      title="Manage Payout Accounts"
      isShown={isShownManageModal}
      className="min-w-[480px]"
      hide={hideManageModal}
      modalContent={
        <ManagePayoutAccountModal
          organization={organization}
          onCreateNew={handleCreateFromManage}
        />
      }
    />
  )

  const createModal = (
    <Modal
      title="Create Payout Account"
      isShown={isShownCreateModal}
      className="min-w-100"
      hide={hideCreateModal}
      modalContent={
        <AccountCreateModal
          forOrganizationId={organization.id}
          returnPath={`/dashboard/${organization.slug}/finance/account`}
        />
      }
    />
  )

  if (isManualAccount) {
    return (
      <>
        <StatusBlock
          tone="neutral"
          icon={BanknoteIcon}
          title="Manual payouts"
          description={
            <>
              You are receiving manual payouts.{' '}
              <a
                href="mailto:support@polar.sh"
                className="underline hover:no-underline"
              >
                Reach out to support
              </a>{' '}
              to request a payout or change this.
            </>
          }
        />
        {manageModal}
        {createModal}
      </>
    )
  }

  if (isStripeAccount) {
    const ready = payoutAccount.is_payout_ready
    return (
      <>
        <StatusBlock
          tone={ready ? 'success' : 'pending'}
          icon={ready ? CheckIcon : BanknoteIcon}
          title={
            ready ? 'Payout account connected' : 'Payout account needs setup'
          }
          description={
            ready
              ? 'Your Stripe payout account is configured and ready to receive payouts.'
              : 'Your Stripe payout account is connected but onboarding isn’t complete yet.'
          }
          action={
            <Button onClick={showManageModal}>
              Manage payout accounts
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          }
        />
        {manageModal}
        {createModal}
      </>
    )
  }

  return (
    <>
      <StatusBlock
        tone="neutral"
        icon={BanknoteIcon}
        title={
          hasReusableAccounts
            ? 'Choose a payout account'
            : 'Connect payout account'
        }
        description={
          hasReusableAccounts
            ? 'Reuse a Stripe account from one of your other organizations, or connect a new one.'
            : 'Connect or create a Stripe account to receive payments from your customers.'
        }
        action={
          <Button
            onClick={hasReusableAccounts ? showManageModal : showCreateModal}
          >
            {hasReusableAccounts
              ? 'Manage payout accounts'
              : 'Continue with account setup'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        }
      />
      {manageModal}
      {createModal}
    </>
  )
}
