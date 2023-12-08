'use client'

import Pagination, { usePagination } from '@/components/Shared/Pagination'
import AccountBanner from '@/components/Transactions/AccountBanner'
import TransactionsList from '@/components/Transactions/TransactionsList'
import { useAuth, usePersonalOrganization } from '@/hooks'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms'
import { Separator } from 'polarkit/components/ui/separator'
import { useAccount, useUserPaymentTransactions } from 'polarkit/hooks'

export default function ClientPage() {
  const { currentUser } = useAuth()
  const { currentPage, setCurrentPage } = usePagination()
  const personalOrganization = usePersonalOrganization()

  const { data: organizationAccount } = useAccount(
    personalOrganization?.account_id,
  )

  const transactions = useUserPaymentTransactions({
    userId: currentUser?.id,
    page: currentPage,
  })

  return (
    <div className="flex flex-col gap-y-6">
      {personalOrganization && currentUser && (
        <AccountBanner
          organization={personalOrganization}
          user={currentUser}
          isPersonal
        />
      )}
      <ShadowBoxOnMd>
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-col gap-y-2">
            <h2 className="text-lg font-medium capitalize">Transactions</h2>
            <p className="dark:text-polar-500 text-sm text-gray-500">
              Payments made to maintainers on Polar
            </p>
          </div>
        </div>
        <Separator className="my-8" />
        <Pagination
          currentPage={currentPage}
          totalCount={transactions.data?.pagination.total_count ?? 0}
          pageSize={20}
          onPageChange={setCurrentPage}
        >
          <TransactionsList transactions={transactions.data?.items ?? []} />
        </Pagination>
      </ShadowBoxOnMd>
    </div>
  )
}
