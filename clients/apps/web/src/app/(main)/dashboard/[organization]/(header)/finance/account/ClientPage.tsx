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
import { ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'
import Banner from '@polar-sh/ui/components/molecules/Banner'
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
        <h2 className="text-xl">Organization details</h2>
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
        <Banner
          color="default"
          right={
            <Button size="sm" onClick={showOrganizationDetailsModal}>
              Complete organization details
            </Button>
          }
        >
          <ExclamationCircleIcon className="h-6 w-6 text-red-500" />
          <span className="text-sm">
            Please share details of your intended use case of Polar for our
            compliance- and{' '}
            <a
              href="https://docs.polar.sh/merchant-of-record/acceptable-use"
              className="text-blue-500"
              target="_blank"
            >
              acceptable use
            </a>{' '}
            reviews.
          </span>
        </Banner>
      )}

      {accounts ? (
        <AccountSetup
          organization={organization}
          organizationAccount={organizationAccount}
          loading={linkAccountLoading}
          disabled={requireDetails}
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
