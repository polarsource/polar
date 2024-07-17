'use client'

import { useSearchDonations } from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { githubIssueLink } from '@/utils/github'
import { ArrowUpRightIcon } from '@heroicons/react/24/outline'
import { CurrencyAmount, Donation, Issue, Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import { getCentsInDollarString } from 'polarkit/lib/money'
import React from 'react'

interface DonorsTableProps {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
}

const DonorsTable: React.FC<DonorsTableProps> = ({
  organization,
  pagination,
  sorting,
}) => {
  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    return params
  }

  const router = useRouter()

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
      `/maintainer/${organization.slug}/donations/overview?${getSearchParams(
        updatedPagination,
        sorting,
      )}`,
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
      `/maintainer/${organization.slug}/donations/overview?${getSearchParams(
        pagination,
        updatedSorting,
      )}`,
    )
  }

  const donationsHook = useSearchDonations({
    toOrganizationId: organization.id,
    ...getAPIParams(pagination, sorting),
  })

  const donations = donationsHook.data?.items || []
  const pageCount = donationsHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<Donation>[] = [
    {
      id: 'donor',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Donor" />
      ),
      cell: ({ row: { original: donation } }) => {
        if (!donation.donor) {
          return (
            <div className="flex flex-row items-center gap-2">
              <div className="fw-medium">{donation.email}</div>
            </div>
          )
        }

        if ('is_personal' in donation.donor) {
          return (
            <div className="flex flex-row items-center gap-2">
              <Avatar
                avatar_url={donation.donor.avatar_url}
                name={donation.donor.name}
              />
              <div className="fw-medium">{donation.donor.name}</div>
              <div className="fw-medium">{donation.email}</div>
            </div>
          )
        }

        return (
          <div className="flex flex-row items-center gap-2">
            <Avatar
              avatar_url={donation.donor?.avatar_url ?? undefined}
              name={donation.donor.public_name}
            />
            <div className="fw-medium">{donation.donor.public_name}</div>
            <div className="fw-medium">{donation.email}</div>
          </div>
        )
      },
    },
    {
      accessorKey: 'created_at',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Donation date" />
      ),
      cell: (props) => (
        <FormattedDateTime datetime={props.getValue() as string} />
      ),
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      cell: (props) => {
        const amount = props.getValue() as CurrencyAmount
        return <>${getCentsInDollarString(amount.amount)}</>
      },
    },
    {
      id: 'message',
      accessorKey: 'message',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Message" />
      ),
      cell: (props) => {
        const message = props.getValue() as string | undefined

        if (!message) {
          return <span className="text-gray-300">-</span>
        }

        return (
          <p className="text-gray-700 dark:text-gray-400">
            &quot;{message}&quot;
          </p>
        )
      },
    },
    {
      id: 'issue',
      accessorKey: 'issue',
      enableSorting: false,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Issue" />
      ),
      cell: (props) => {
        const issue = props.getValue() as Issue | undefined

        if (!issue) {
          return <span className="text-gray-300">-</span>
        }

        return (
          <a
            href={githubIssueLink(issue)}
            className="inline-flex items-center gap-1 text-blue-700 underline dark:text-blue-400 "
          >
            <span>{issue.title}</span>
            <ArrowUpRightIcon className="h-3 w-3" />
          </a>
        )
      },
    },
  ]

  return (
    <>
      {donations && pageCount !== undefined ? (
        <DataTable
          columns={columns}
          data={donations}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={sorting}
          onSortingChange={setSorting}
          isLoading={donationsHook}
        />
      ) : null}
    </>
  )
}

export default DonorsTable
