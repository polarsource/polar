import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import { Modal } from '@polar-sh/orbit'
import { useModal } from '@/components/Modal/useModal'
import ManagePayoutAccountModal from '@/components/Payouts/ManagePayoutAccountModal'
import {
  usePayoutAccount,
  usePayoutAccounts,
} from '@/hooks/queries/payout_accounts'
import { schemas } from '@polar-sh/client'
import { ReactNode, useCallback } from 'react'

interface UsePayoutAccountSetupResult {
  payoutAccount: schemas['PayoutAccount'] | undefined
  hasReusableAccounts: boolean
  openCreate: () => void
  openManage: () => void
  openPrimary: () => void
  modals: ReactNode
}

export const usePayoutAccountSetup = (
  organization: schemas['Organization'],
  returnPath: string,
): UsePayoutAccountSetupResult => {
  const { data: payoutAccount } = usePayoutAccount(
    organization.payout_account_id ?? undefined,
  )
  const { data: payoutAccountsList } = usePayoutAccounts()
  const hasReusableAccounts = (payoutAccountsList?.items?.length ?? 0) > 0

  const {
    isShown: isCreateShown,
    show: openCreate,
    hide: hideCreate,
  } = useModal()
  const {
    isShown: isManageShown,
    show: openManage,
    hide: hideManage,
  } = useModal()

  const handleCreateFromManage = useCallback(() => {
    hideManage()
    openCreate()
  }, [hideManage, openCreate])

  const openPrimary = useCallback(() => {
    if (hasReusableAccounts) {
      openManage()
    } else {
      openCreate()
    }
  }, [hasReusableAccounts, openManage, openCreate])

  const modals = (
    <>
      <Modal
        title="Create Payout Account"
        isShown={isCreateShown}
        className="min-w-100"
        hide={hideCreate}
        modalContent={
          <AccountCreateModal
            forOrganizationId={organization.id}
            returnPath={returnPath}
            defaultCountry={organization.country}
          />
        }
      />
      <Modal
        title="Manage Payout Accounts"
        isShown={isManageShown}
        className="sm:min-w-[560px]"
        hide={hideManage}
        modalContent={
          <ManagePayoutAccountModal
            organization={organization}
            onCreateNew={handleCreateFromManage}
          />
        }
      />
    </>
  )

  return {
    payoutAccount,
    hasReusableAccounts,
    openCreate,
    openManage,
    openPrimary,
    modals,
  }
}
