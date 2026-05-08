'use client'

import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import ManagePayoutAccountModal from '@/components/Payouts/ManagePayoutAccountModal'
import {
  usePayoutAccount,
  usePayoutAccounts,
} from '@/hooks/queries/payout_accounts'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ArrowRight, BanknoteIcon, CheckIcon, ExternalLink } from 'lucide-react'
import { useCallback, useState } from 'react'
import { StatusBlock } from './StatusBlock'

interface Props {
  organization: schemas['Organization']
}

export const PayoutAccountSection = ({ organization }: Props) => {
  const { data: payoutAccount } = usePayoutAccount(
    organization.payout_account_id || undefined,
  )
  const { data: payoutAccountsList } = usePayoutAccounts()
  const hasReusableAccounts = (payoutAccountsList?.items?.length ?? 0) > 0
  const isAccountSetupComplete = payoutAccount && payoutAccount.is_payout_ready

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

  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)

  const handleStartAccountSetup = useCallback(async () => {
    if (!payoutAccount) {
      if (hasReusableAccounts) {
        showManageModal()
      } else {
        showCreateModal()
      }
      return
    }
    const link = await unwrap(
      api.POST('/v1/payout-accounts/{id}/onboarding-link', {
        params: {
          path: { id: payoutAccount.id },
          query: {
            return_path: `/dashboard/${organization.slug}/finance/account`,
          },
        },
      }),
    )
    window.location.href = link.url
  }, [
    organization.slug,
    payoutAccount,
    hasReusableAccounts,
    showCreateModal,
    showManageModal,
  ])

  const handleCreateFromManage = useCallback(() => {
    hideManageModal()
    showCreateModal()
  }, [hideManageModal, showCreateModal])

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
    } finally {
      setIsLoadingDashboard(false)
    }
  }, [payoutAccount])

  if (isAccountSetupComplete && payoutAccount.type === 'stripe') {
    return (
      <StatusBlock
        tone="success"
        icon={CheckIcon}
        title="Account setup complete"
        description="Your Stripe payout account is configured and ready to receive payouts."
        action={
          <Button
            onClick={handleOpenStripeDashboard}
            loading={isLoadingDashboard}
          >
            Open in Stripe
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        }
      />
    )
  }

  if (isAccountSetupComplete) {
    return (
      <StatusBlock
        tone="neutral"
        icon={BanknoteIcon}
        title="Manual payouts"
        description={
          <>
            You&apos;re receiving manual payouts.{' '}
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
          <Button onClick={handleStartAccountSetup}>
            {hasReusableAccounts
              ? 'Manage payout accounts'
              : 'Continue with account setup'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        }
      />
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
    </>
  )
}
