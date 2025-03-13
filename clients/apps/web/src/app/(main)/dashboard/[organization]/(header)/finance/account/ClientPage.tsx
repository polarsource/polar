'use client'

import AccountCreateModal from '@/components/Accounts/AccountCreateModal'
import AccountSetup from '@/components/Accounts/AccountSetup'
import AccountsList from '@/components/Accounts/AccountsList'
import { Modal } from '@/components/Modal'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import OrganizationProfileSettings from '@/components/Settings/OrganizationProfileSettings'
import { useListAccounts, useOrganizationAccount } from '@/hooks/queries'
import { api } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import { Separator } from '@polar-sh/ui/components/ui/separator'
import { useCallback, useState } from 'react'

const OrganizationDetailsModal = ({
  organization,
  hideModal,
}: {
  organization: schemas['Organization']
  hideModal: () => void
}) => {
  return (
    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-12">
      <div className="flex flex-row items-center gap-x-4">
        <h2 className="text-xl">Organization KYC</h2>
      </div>
      <OrganizationProfileSettings
        organization={organization}
        kyc={true}
        onSubmitted={hideModal}
      />
    </div>
  )
}

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

  const {
    isShown: isOrganizationDetailsShown,
    show: showOrganizationDetailsModal,
    hide: hideOrganizationDetailsModal,
  } = useModal()

  const requireDetails = !organization.details_submitted_at

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
      {requireDetails && (
        <div className="">
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Before proceeding we need more information about your business and
            use case of Polar for our reviews.
          </p>
          <Button
            type="button"
            className="mt-2"
            onClick={showOrganizationDetailsModal}
          >
            Add business details
          </Button>
        </div>
      )}

      {!requireDetails && accounts ? (
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
      <InlineModal
        modalContent={
          <OrganizationDetailsModal
            organization={organization}
            hideModal={hideOrganizationDetailsModal}
          />
        }
        isShown={isOrganizationDetailsShown}
        hide={hideOrganizationDetailsModal}
      />
    </div>
  )
}
