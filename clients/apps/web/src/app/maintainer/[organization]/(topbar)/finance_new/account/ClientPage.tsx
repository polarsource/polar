'use client'

import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import AccountSetup from '@/components/Accounts/AccountSetup'
import AccountsList from '@/components/Accounts/AccountsList'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { api } from 'polarkit'
import { ALL_ACCOUNT_TYPES } from 'polarkit/account'
import { Separator } from 'polarkit/components/ui/separator'
import { useAccount, useListAccounts } from 'polarkit/hooks'
import { useCallback, useState } from 'react'

export default function ClientPage() {
  const { org } = useCurrentOrgAndRepoFromURL()
  const { data: accounts } = useListAccounts()
  const {
    isShown: isShownSetupModal,
    show: showSetupModal,
    hide: hideSetupModal,
  } = useModal()

  const { data: organizationAccount } = useAccount(org?.account_id)

  const [linkAccountLoading, setLinkAccountLoading] = useState(false)
  const onLinkAccount = useCallback(
    async (accountId: string) => {
      if (org) {
        setLinkAccountLoading(true)
        try {
          await api.organizations.setAccount({
            id: org.id,
            organizationSetAccount: { account_id: accountId },
          })
          window.location.reload()
        } finally {
          setLinkAccountLoading(false)
        }
      }
    },
    [org],
  )
  return (
    <div className="flex flex-col gap-y-6">
      {org && accounts && (
        <AccountSetup
          organization={org}
          accounts={accounts.items || []}
          organizationAccount={organizationAccount}
          loading={linkAccountLoading}
          onLinkAccount={onLinkAccount}
          onAccountSetup={showSetupModal}
        />
      )}
      {accounts?.items && accounts.items.length > 0 && (
        <div className="dark:bg-polar-900 dark:border-polar-800 min-h-[480px] rounded-3xl border border-gray-100 bg-white p-12">
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-y-2">
              <h2 className="text-lg font-medium">All payout accounts</h2>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Payout accounts you manage
              </p>
            </div>
          </div>
          <Separator className="my-8" />
          {org && accounts?.items && (
            <AccountsList
              accounts={accounts?.items}
              returnPath={`/maintainer/${org.name}/finance_new/account`}
            />
          )}
        </div>
      )}
      <Modal
        isShown={isShownSetupModal}
        className="min-w-[400px]"
        hide={hideSetupModal}
        modalContent={
          <AccountCreateModal
            onClose={hideSetupModal}
            accountTypes={ALL_ACCOUNT_TYPES}
            forOrganizationId={org?.id}
            returnPath={`/maintainer/${org?.name}/finance_new/account`}
          />
        }
      />
    </div>
  )
}
