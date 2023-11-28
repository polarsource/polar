'use client'

import { usePagination } from '@/components/Shared/Pagination'
import TransactionsList from '@/components/Transactions/TransactionsList'
import { useAuth } from '@/hooks'
import { TransactionType } from '@polar-sh/sdk'
import { useRouter, useSearchParams } from 'next/navigation'
import { Separator } from 'polarkit/components/ui/separator'
import {
  useListAccountsByOrganization,
  useListAccountsByUser,
  useListAdminOrganizations,
  useSearchTransactions,
} from 'polarkit/hooks'
import { useCallback } from 'react'

export default function ClientPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { currentUser } = useAuth()
  const organizations = useListAdminOrganizations()
  const personalOrganization = organizations.data?.items?.find(
    (org) => org.name === currentUser?.username,
  )
  const { currentPage, setCurrentPage } = usePagination()

  const setActiveTab = useCallback((value: string) => {
    router.replace(`/finance/incoming?type=${value}`)
  }, [])

  const accounts = useListAccountsByUser(currentUser?.id ?? '')
  const organizationAccounts = useListAccountsByOrganization(
    personalOrganization?.id,
  )
  const [account] = accounts.data?.items ?? []
  const [organizationAccount] = organizationAccounts.data?.items ?? []

  const transactions = useSearchTransactions({
    accountId: account.id,
    page: currentPage,
    type: TransactionType.PAYMENT,
  })

  return (
    <div className="dark:bg-polar-900 dark:border-polar-800 min-h-[480px] rounded-3xl border border-gray-100 bg-white p-12">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-y-2">
          <h2 className="text-lg font-medium capitalize">Transactions</h2>
        </div>
      </div>
      <Separator className="my-8" />
      {account && (
        <TransactionsList
          accountId={account.id}
          type={TransactionType.PAYMENT}
          pageSize={20}
        />
      )}
    </div>
  )
}
