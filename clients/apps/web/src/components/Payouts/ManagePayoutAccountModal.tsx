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
import { useOrganization } from '@/hooks/queries'

interface ManagePayoutAccountModalProps {
  organization: schemas['Organization']
  onCreateNew: () => void
}

const ManagePayoutAccountModal: React.FC<ManagePayoutAccountModalProps> = ({
  organization: _organization,
  onCreateNew,
}) => {
  const { data: organization, refetch: refetchOrganization } = useOrganization(
    _organization.id,
    true,
    _organization,
  )
  const {
    data: payoutAccountsList,
    isLoading,
    refetch: refetchPayoutAccounts,
  } = usePayoutAccounts()
  const deletePayoutAccount = useDeletePayoutAccount()
  const setOrganizationPayoutAccount = useSetOrganizationPayoutAccount(
    _organization.id,
  )
  const [loadingDashboardId, setLoadingDashboardId] = useState<string | null>(
    null,
  )

  const handleOpenStripeLink = useCallback(
    async (payoutAccount: schemas['PayoutAccount']) => {
      setLoadingDashboardId(payoutAccount.id)
      try {
        const link = await unwrap(
          payoutAccount.is_payout_ready
            ? api.POST('/v1/payout-accounts/{id}/dashboard-link', {
                params: { path: { id: payoutAccount.id } },
              })
            : api.POST('/v1/payout-accounts/{id}/onboarding-link', {
                params: {
                  path: { id: payoutAccount.id },
                  query: {
                    return_path: `/dashboard/${_organization.slug}/finance/account`,
                  },
                },
              }),
        )
        window.open(link.url, '_blank')
      } catch {
        toast({
          title: payoutAccount.is_payout_ready
            ? 'Failed to open Stripe dashboard'
            : 'Failed to open Stripe onboarding',
          description: 'An error occurred while generating the link.',
        })
      } finally {
        setLoadingDashboardId(null)
      }
    },
    [_organization],
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
        refetchOrganization()
        refetchPayoutAccounts()
      }
    },
    [deletePayoutAccount, refetchOrganization, refetchPayoutAccounts],
  )

  const handleSwitch = useCallback(
    async (payoutAccountId: string) => {
      const { error } =
        await setOrganizationPayoutAccount.mutateAsync(payoutAccountId)
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
        refetchOrganization()
      }
    },
    [setOrganizationPayoutAccount, refetchOrganization],
  )

  const accounts = [...(payoutAccountsList?.items ?? [])].sort((a, b) => {
    const aActive =
      organization && a.id === organization.payout_account_id ? 1 : 0
    const bActive =
      organization && b.id === organization.payout_account_id ? 1 : 0
    return bActive - aActive
  })

  return (
    <div className="flex flex-col gap-y-6 p-8">
      <h3 className="text-xl font-medium">Manage Payout Accounts</h3>
      {isLoading ? (
        <div className="flex flex-col gap-y-3">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="dark:bg-polar-800 h-20 animate-pulse rounded-2xl bg-gray-100"
            />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <p className="dark:text-polar-500 text-sm text-gray-500">
          No payout accounts found.
        </p>
      ) : (
        <ul className="flex flex-col gap-y-3">
          {accounts.map((account) => {
            const isActive =
              organization && account.id === organization.payout_account_id
            return (
              <li
                key={account.id}
                className="dark:border-polar-700 dark:bg-polar-800 flex flex-col gap-y-4 rounded-2xl border border-gray-200 bg-white p-4"
              >
                <div className="flex flex-row items-center justify-between gap-x-4">
                  <div className="flex flex-row items-center gap-x-3">
                    <span className="font-medium capitalize">
                      {account.type}
                    </span>
                    {isActive && (
                      <span className="dark:bg-polar-700 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-300">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex flex-row flex-wrap justify-end gap-2">
                    {account.type === 'stripe' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenStripeLink(account)}
                        loading={loadingDashboardId === account.id}
                      >
                        {account.is_payout_ready
                          ? 'Open in Stripe'
                          : 'Complete Setup'}
                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
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
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
                <div className="dark:border-polar-700 flex flex-row items-center gap-x-4 border-t border-gray-100 pt-3">
                  <span className="dark:text-polar-400 text-xs text-gray-500">
                    {account.country.toUpperCase()} ·{' '}
                    {account.currency.toUpperCase()}
                  </span>
                  <span
                    className={`inline-flex items-center gap-x-1.5 text-xs ${
                      account.is_payout_ready
                        ? 'text-green-600 dark:text-green-500'
                        : 'text-yellow-600 dark:text-yellow-500'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        account.is_payout_ready
                          ? 'bg-green-600 dark:bg-green-500'
                          : 'bg-yellow-600 dark:bg-yellow-500'
                      }`}
                    />
                    {account.is_payout_ready ? 'Ready' : 'Setup required'}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Button className="self-start" variant="secondary" onClick={onCreateNew}>
        <Plus className="mr-2 h-4 w-4" />
        Add Payout Account
      </Button>
    </div>
  )
}

export default ManagePayoutAccountModal
