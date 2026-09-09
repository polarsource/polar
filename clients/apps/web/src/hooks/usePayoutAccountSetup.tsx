import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import { Modal } from '@polar-sh/orbit'
import { useModal } from '@/components/Modal/useModal'
import ManagePayoutAccountModal from '@/components/Payouts/ManagePayoutAccountModal'
import { usePayoutAccount } from '@/hooks/queries/payout_accounts'
import { schemas } from '@polar-sh/client'
import { ReactNode, useCallback } from 'react'

interface UsePayoutAccountSetupResult {
  payoutAccount: schemas['PayoutAccount'] | undefined
  openCreate: () => void
  openManage: () => void
  modals: ReactNode
}

export const usePayoutAccountSetup = (
  organization: schemas['Organization'],
  returnPath: string,
): UsePayoutAccountSetupResult => {
  const { data: payoutAccount } = usePayoutAccount(
    organization.payout_account_id ?? undefined,
  )
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
    openCreate,
    openManage,
    modals,
  }
}
