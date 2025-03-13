'use client'

import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import AccountSetup from '@/components/Accounts/AccountSetup'
import AccountsList from '@/components/Accounts/AccountsList'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { useListAccounts, useOrganizationAccount } from '@/hooks/queries'
import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { useCallback, useState } from 'react'

export default function ClientPage({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const { data: accounts } = useListAccounts()
  const {
    isShown: isShownSetupModal,
    show: showSetupModal,
    hide: hideSetupModal,
  } = useModal()

  const { data: organizationAccount } = useOrganizationAccount(organization.id)

  const [linkAccountLoading, setLinkAccountLoading] = useState(false)
  const onLinkAccount = useCallback(
    async (accountId: string) => {
      setLinkAccountLoading(true)
      const { error } = await api.PATCH('/v1/organizations/{id}/account', {
        params: { path: { id: organization.id } },
        body: { account_id: accountId },
      })
      setLinkAccountLoading(false)
      if (!error) {
        window.location.reload()
      }
    },
    [organization],
  )

  return (
    <div className="flex flex-col gap-y-6">
      {accounts ? (
        <AccountSetup
          organization={organization}
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
              returnPath={`/dashboard/${organization.slug}/finance/account`}
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
            forOrganizationId={organization.id}
            returnPath={`/dashboard/${organization.slug}/finance/account`}
          />
        }
      />
    </div>
  )
}
