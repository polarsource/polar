import {
  useDeletePayoutAccount,
  usePayoutAccounts,
  useSetOrganizationPayoutAccount,
} from '@/hooks/queries/payout_accounts'
import { toast } from '@/components/Toast/use-toast'
import { api } from '@/utils/client'
import { schemas, unwrap } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import React, { useCallback, useState } from 'react'

interface ManagePayoutAccountModalProps {
  organization: schemas['Organization']
  onCreateNew: () => void
}

const ManagePayoutAccountModal: React.FC<ManagePayoutAccountModalProps> = ({
  organization,
  onCreateNew,
}) => {
  const { data: payoutAccountsList, isLoading } = usePayoutAccounts()
  const deletePayoutAccount = useDeletePayoutAccount()
  const setOrganizationPayoutAccount = useSetOrganizationPayoutAccount(
    organization.id,
  )
  const [loadingDashboardId, setLoadingDashboardId] = useState<string | null>(
    null,
  )

  const handleOpenStripeDashboard = useCallback(
    async (payoutAccount: schemas['PayoutAccount']) => {
      setLoadingDashboardId(payoutAccount.id)
      try {
        const link = await unwrap(
          api.POST('/v1/payout-accounts/{id}/dashboard-link', {
            params: { path: { id: payoutAccount.id } },
          }),
        )
        window.open(link.url, '_blank')
      } catch {
        toast({
          title: 'Failed to open Stripe dashboard',
          description: 'An error occurred while generating the dashboard link.',
        })
      } finally {
        setLoadingDashboardId(null)
      }
    },
    [],
  )

  const handleDelete = useCallback(
    async (payoutAccountId: string) => {
      const { error } = await deletePayoutAccount.mutateAsync(payoutAccountId)
      if (error) {
        toast({
          title: 'Failed to delete payout account',
          description:
            typeof error.detail === 'string'
              ? error.detail
              : 'An error occurred while deleting the payout account.',
        })
      } else {
        toast({
          title: 'Payout account deleted',
          description: 'Your payout account has been successfully deleted.',
        })
      }
    },
    [deletePayoutAccount],
  )

  const handleSwitch = useCallback(
    async (payoutAccountId: string) => {
      const { error } = await setOrganizationPayoutAccount.mutateAsync(
        payoutAccountId,
      )
      if (error) {
        toast({
          title: 'Failed to switch payout account',
          description:
            typeof error.detail === 'string'
              ? error.detail
              : 'An error occurred while switching the payout account.',
        })
      } else {
        toast({
          title: 'Payout account updated',
          description: 'Your active payout account has been updated.',
        })
      }
    },
    [setOrganizationPayoutAccount],
  )

  const accounts = payoutAccountsList?.items ?? []

  return (
    <div className="flex flex-col gap-y-6 p-8">
      <h3 className="text-xl font-medium">Manage Payout Accounts</h3>
      {isLoading ? (
        <div className="dark:text-polar-500 text-sm text-gray-500">
          Loading…
        </div>
      ) : accounts.length === 0 ? (
        <p className="dark:text-polar-500 text-sm text-gray-500">
          No payout accounts found.
        </p>
      ) : (
        <ul className="flex flex-col gap-y-3">
          {accounts.map((account) => {
            const isActive = account.id === organization.payout_account_id
            return (
              <li
                key={account.id}
                className="dark:bg-polar-800 flex flex-row items-center justify-between gap-x-4 rounded-xl bg-gray-100 p-4"
              >
                <div className="flex flex-row items-center gap-x-3">
                  <span className="capitalize">{account.type}</span>
                  {isActive && (
                    <span className="dark:bg-polar-700 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                      Active
                    </span>
                  )}
                </div>
                <div className="flex flex-row flex-wrap gap-2">
                  {account.type === 'stripe' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenStripeDashboard(account)}
                      loading={loadingDashboardId === account.id}
                    >
                      Open in Stripe
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                  {!isActive && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSwitch(account.id)}
                      loading={setOrganizationPayoutAccount.isPending}
                    >
                      Make Active
                    </Button>
                  )}
                  {!isActive && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(account.id)}
                      loading={deletePayoutAccount.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Button
        className="self-start"
        variant="secondary"
        onClick={onCreateNew}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Payout Account
      </Button>
    </div>
  )
}

export default ManagePayoutAccountModal
