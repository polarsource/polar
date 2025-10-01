'use client'

import AccessRestricted from '@/components/Finance/AccessRestricted'
import AccountBalance from '@/components/Payouts/AccountBalance'
import DownloadInvoice, {
  InvoiceModal,
} from '@/components/Payouts/DownloadInvoice'
import { PayoutProvider } from '@/components/Payouts/PayoutContext'
import { PayoutStatus } from '@/components/Payouts/PayoutStatus'
import AccountBanner from '@/components/Transactions/AccountBanner'
import { platformFeesDisplayNames } from '@/components/Transactions/TransactionsList'
import { useOrganizationAccount } from '@/hooks/queries'
import { usePayouts } from '@/hooks/queries/payouts'
import { getServerURL } from '@/utils/api'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import { EllipsisVertical } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const isPayout = (
  item: schemas['Payout'] | schemas['TransactionEmbedded'],
): item is schemas['Payout'] => {
  return (item as schemas['Payout']).status !== undefined
}

export default function ClientPage({
  pagination,
  sorting,
  organization,
}: {
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const pathname = usePathname()

  const setPagination = (
    updaterOrValue:
      | DataTablePaginationState
      | ((old: DataTablePaginationState) => DataTablePaginationState),
  ) => {
    const updatedPagination =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(pagination)
        : updaterOrValue

    router.push(
      `${pathname}?${serializeSearchParams(updatedPagination, sorting)}`,
    )
  }

  const setSorting = (
    updaterOrValue:
      | DataTableSortingState
      | ((old: DataTableSortingState) => DataTableSortingState),
  ) => {
    const updatedSorting =
      typeof updaterOrValue === 'function'
        ? updaterOrValue(sorting)
        : updaterOrValue

    router.push(
      `${pathname}?${serializeSearchParams(pagination, updatedSorting)}`,
    )
  }

  const { data: account, error: accountError } = useOrganizationAccount(
    organization.id,
  )

  const isNotAdmin =
    accountError && (accountError as any)?.response?.status === 403

  const { data: payouts, isLoading } = usePayouts(account?.id, {
    ...getAPIParams(pagination, sorting),
  })

  const columns: DataTableColumnDef<
    schemas['Payout'] | schemas['TransactionEmbedded']
  >[] = [
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ getValue }) => {
        return (
          <FormattedDateTime
            datetime={getValue() as string}
            resolution="time"
          />
        )
      },
    },
    {
      accessorKey: 'paid_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Paid At" />
      ),
      cell: ({ getValue }) => {
        const value = getValue()
        return value ? (
          <FormattedDateTime datetime={getValue() as string} resolution="day" />
        ) : (
          '—'
        )
      },
    },
    {
      accessorKey: 'status',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row: { original } }) => {
        if (isPayout(original)) {
          return (
            <div className="flex flex-row items-center">
              <PayoutStatus status={original.status} />
            </div>
          )
        }
        if (original.platform_fee_type) {
          return <>{platformFeesDisplayNames[original.platform_fee_type]}</>
        }
      },
    },
    {
      accessorKey: 'gross_amount',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Gross"
          className="flex justify-end"
        />
      ),
      cell: ({ row: { original } }) => {
        return (
          <div className="flex flex-row justify-end">
            {isPayout(original)
              ? formatCurrencyAndAmount(
                  original.gross_amount,
                  original.currency,
                )
              : '—'}
          </div>
        )
      },
    },
    {
      accessorKey: 'fees_amount',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Fees"
          className="flex justify-end"
        />
      ),
      cell: ({ row: { original } }) => {
        return (
          <div className="flex flex-row justify-end">
            {isPayout(original)
              ? formatCurrencyAndAmount(original.fees_amount, original.currency)
              : formatCurrencyAndAmount(
                  Math.abs(original.amount),
                  original.currency,
                )}
          </div>
        )
      },
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Net"
          className="flex justify-end"
        />
      ),
      cell: ({ row: { original } }) => {
        return (
          <div className="flex flex-row justify-end">
            {isPayout(original)
              ? formatCurrencyAndAmount(original.amount, original.currency)
              : '—'}
          </div>
        )
      },
    },
    {
      id: 'actions',
      enableSorting: false,
      cell: ({ row: { original } }) => {
        if (!isPayout(original)) {
          return null
        }
        return (
          <div className="flex flex-row justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none" asChild>
                <Button
                  className={
                    'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
                  }
                  size="icon"
                  variant="secondary"
                >
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="dark:bg-polar-800 bg-gray-50 shadow-lg"
              >
                {original.status === 'succeeded' && account && (
                  <DownloadInvoice
                    organization={organization}
                    account={account}
                    payout={original}
                  />
                )}
                <DropdownMenuItem>
                  <Link
                    href={`${getServerURL()}/v1/payouts/${original.id}/csv`}
                  >
                    Download CSV
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]

  if (isNotAdmin) {
    return (
      <div className="flex flex-col gap-y-6">
        <AccessRestricted message="You are not the admin of the account. Only the account admin can view payout information." />
      </div>
    )
  }

  return (
    <PayoutProvider>
      <div className="flex flex-col gap-y-6">
        <AccountBanner organization={organization} />
        {account && (
          <AccountBalance account={account} organization={organization} />
        )}
        <DataTable
          columns={columns}
          data={payouts?.items ?? []}
          rowCount={payouts?.pagination.total_count ?? 0}
          pageCount={payouts?.pagination.max_page ?? 0}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={sorting}
          onSortingChange={setSorting}
          isLoading={isLoading}
          getSubRows={(row) =>
            isPayout(row) ? row.fees_transactions : undefined
          }
          onRowClick={(row) => row.getToggleExpandedHandler()()}
        />
        {account && (
          <InvoiceModal organization={organization} account={account} />
        )}
      </div>
    </PayoutProvider>
  )
}
