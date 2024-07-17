'use client'

import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import AccountSetup from '@/components/Accounts/AccountSetup'
import AccountsList from '@/components/Accounts/AccountsList'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { useAuth } from '@/hooks'
import { useAccount, useListAccounts } from '@/hooks/queries'
import { ALL_ACCOUNT_TYPES } from '@/utils/account'
import { api } from '@/utils/api'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { Separator } from 'polarkit/components/ui/separator'
import { useCallback, useEffect, useState } from 'react'

export default function ClientPage() {
  const { currentUser, reloadUser } = useAuth()
  const { data: accounts } = useListAccounts()
  const {
    isShown: isShownSetupModal,
    show: showSetupModal,
    hide: hideSetupModal,
  } = useModal()

  // Force the user to reload to make sure we have the latest account
  useEffect(() => {
    reloadUser()
    // eslint-disable-next-line
  }, [])

  const { data: personalAccount } = useAccount(currentUser?.account_id)

  const [linkAccountLoading, setLinkAccountLoading] = useState(false)
  const onLinkAccount = useCallback(
    async (accountId: string) => {
      setLinkAccountLoading(true)
      try {
        await api.users.setAccount({
          body: { account_id: accountId },
        })
        await reloadUser()
        window.location.reload()
      } finally {
        setLinkAccountLoading(false)
      }
    },
    [reloadUser],
  )
  return (
    <div className="flex flex-col gap-y-6">
      {accounts && (
        <AccountSetup
          organization={undefined}
          organizationAccount={undefined}
          accounts={accounts.items || []}
          personalAccount={personalAccount}
          loading={linkAccountLoading}
          onLinkAccount={onLinkAccount}
          onAccountSetup={showSetupModal}
        />
      )}
      {accounts?.items && accounts.items.length > 0 && (
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
              returnPath="/finance/account"
            />
          )}
        </ShadowBoxOnMd>
      )}
      <Modal
        isShown={isShownSetupModal}
        className="min-w-[400px]"
        hide={hideSetupModal}
        modalContent={
          <AccountCreateModal
            onClose={hideSetupModal}
            accountTypes={ALL_ACCOUNT_TYPES}
            forUserId={currentUser?.id}
            returnPath="/finance/account"
          />
        }
      />
    </div>
  )
}
