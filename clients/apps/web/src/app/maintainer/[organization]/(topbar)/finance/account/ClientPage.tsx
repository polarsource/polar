'use client'

import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import AccountSetup from '@/components/Accounts/AccountSetup'
import AccountsList from '@/components/Accounts/AccountsList'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { Organization } from '@polar-sh/sdk'
import { api } from 'polarkit'
import { ALL_ACCOUNT_TYPES } from 'polarkit/account'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { Separator } from 'polarkit/components/ui/separator'
import { useAccount, useListAccounts } from 'polarkit/hooks'
import { useCallback, useState } from 'react'

export default function ClientPage({
  organization,
}: {
  organization: Organization
}) {
  const { data: accounts } = useListAccounts()
  const {
    isShown: isShownSetupModal,
    show: showSetupModal,
    hide: hideSetupModal,
  } = useModal()

  const { data: organizationAccount } = useAccount(organization.account_id)

  const [linkAccountLoading, setLinkAccountLoading] = useState(false)
  const onLinkAccount = useCallback(
    async (accountId: string) => {
      setLinkAccountLoading(true)
      try {
        await api.organizations.setAccount({
          id: organization.id,
          organizationSetAccount: { account_id: accountId },
        })
        window.location.reload()
      } finally {
        setLinkAccountLoading(false)
      }
    },
    [organization],
  )

  return (
    <div className="flex flex-col gap-y-6">
      {accounts ? (
        <AccountSetup
          organization={organization}
          accounts={accounts.items || []}
          organizationAccount={organizationAccount}
          loading={linkAccountLoading}
          onLinkAccount={onLinkAccount}
          onAccountSetup={showSetupModal}
        />
      ) : null}

      {accounts?.items && accounts.items.length > 0 ? (
        <ShadowBoxOnMd>
          <div className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-y-2">
              <h2 className="text-lg font-medium">All payout accounts</h2>
              <p className="dark:text-polar-500 text-sm text-gray-500">
                Payout accounts you manage
              </p>
            </div>
          </div>
          <Separator className="my-8" />
          {accounts?.items && (
            <AccountsList
              accounts={accounts?.items}
              returnPath={`/maintainer/${organization.name}/finance/account`}
            />
          )}
        </ShadowBoxOnMd>
      ) : null}

      <Modal
        isShown={isShownSetupModal}
        className="min-w-[400px]"
        hide={hideSetupModal}
        modalContent={
          <AccountCreateModal
            onClose={hideSetupModal}
            accountTypes={ALL_ACCOUNT_TYPES}
            forOrganizationId={organization.id}
            returnPath={`/maintainer/${organization.name}/finance/account`}
          />
        }
      />
    </div>
  )
}
