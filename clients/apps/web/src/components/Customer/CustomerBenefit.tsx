// https://github.com/polarsource/polar/issues/6167
'use client'

import { useCustomerBenefitGrantsList } from '@/hooks/queries/benefits'
import {
  DataTablePaginationState,
  DataTableSortingState,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { DataTable } from '@polar-sh/ui/components/atoms/DataTable'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { Status } from '@polar-sh/ui/components/atoms/Status'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import Link from 'next/link'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface CustomerBenefitProps {
  customer: schemas['Customer']
  organization: schemas['Organization']
}

export const CustomerBenefit: React.FC<CustomerBenefitProps> = ({
  customer,
  organization,
}) => {
  const [pagination, setPagination] = React.useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = React.useState<DataTableSortingState>([])

  const { data: benefitGrants, isLoading } = useCustomerBenefitGrantsList({
    customerId: customer.id,
    organizationId: organization.id,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  })

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl">Customer Benefits</h2>
      {benefitGrants?.items.length === 0 && !isLoading ? (
        <div className="flex items-center justify-center p-8 text-gray-500 dark:text-gray-400">
          <p>This customer has no benefit grants.</p>
        </div>
      ) : (
        <DataTable
          data={benefitGrants?.items || []}
          isLoading={isLoading}
          sorting={sorting}
          onSortingChange={setSorting}
          pagination={pagination}
          rowCount={benefitGrants?.pagination.total_count ?? 0}
          pageCount={benefitGrants?.pagination.max_page ?? 1}
          onPaginationChange={setPagination}
          columns={[
            {
              accessorKey: 'benefit',
              header: 'Benefit',
              cell: ({ row: { original: grant } }: { row: { original: schemas['BenefitGrant'] & { benefit: schemas['Benefit'] } } }) => (
                <div className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-col">
                    <div className="w-full truncate text-sm font-medium">
                      {grant.benefit.description}
                    </div>
                    <div className="w-full truncate text-xs text-gray-500 dark:text-gray-400">
                      {grant.benefit.type.replace('_', ' ').split(' ').map(word =>
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              accessorKey: 'status',
              header: 'Status',
              cell: ({ row: { original: grant } }: { row: { original: schemas['BenefitGrant'] & { benefit: schemas['Benefit'] } } }) => {
                const isRevoked = grant.revoked_at !== null
                const isGranted = grant.is_granted
                const hasError = grant.error !== null

                const status = hasError
                  ? 'Error'
                  : isRevoked
                    ? 'Revoked'
                    : isGranted
                      ? 'Granted'
                      : 'Pending'

                const statusDescription = {
                  Revoked: 'The customer does not have access to this benefit',
                  Granted: 'The customer has access to this benefit',
                  Pending: 'The benefit grant is currently being processed',
                  Error: grant.error?.message ?? 'An unknown error occurred',
                }

                const statusClassNames = {
                  Revoked: 'bg-red-100 text-red-500 dark:bg-red-950',
                  Granted: 'bg-emerald-200 text-emerald-500 dark:bg-emerald-950',
                  Pending: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-950',
                  Error: 'bg-red-100 text-red-500 dark:bg-red-950',
                }

                return (
                  <Tooltip>
                    <TooltipTrigger>
                      <Status
                        className={twMerge('w-fit', statusClassNames[status])}
                        status={status}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{statusDescription[status]}</TooltipContent>
                  </Tooltip>
                )
              },
            },
            {
              accessorKey: 'created_at',
              header: 'Granted',
              cell: ({ row: { original: grant } }: { row: { original: schemas['BenefitGrant'] & { benefit: schemas['Benefit'] } } }) => (
                <FormattedDateTime datetime={grant.created_at} />
              ),
            },
            {
              accessorKey: 'revoked_at',
              header: 'Revoked',
              cell: ({ row: { original: grant } }: { row: { original: schemas['BenefitGrant'] & { benefit: schemas['Benefit'] } } }) =>
                grant.revoked_at ? (
                  <FormattedDateTime datetime={grant.revoked_at} />
                ) : (
                  <span className="text-gray-400">—</span>
                ),
            },
            {
              accessorKey: 'order',
              header: 'Order',
              cell: ({ row: { original: grant } }: { row: { original: schemas['BenefitGrant'] & { benefit: schemas['Benefit'] } } }) =>
                grant.order_id ? (
                  <Link
                    href={`/dashboard/${organization.slug}/sales/${grant.order_id}`}
                  >
                    <Button size="sm" variant="secondary">
                      View Order
                    </Button>
                  </Link>
                ) : (
                  <span className="text-gray-400">—</span>
                ),
            },
            {
              accessorKey: 'subscription',
              header: 'Subscription',
              cell: ({ row: { original: grant } }: { row: { original: schemas['BenefitGrant'] & { benefit: schemas['Benefit'] } } }) =>
                grant.subscription_id ? (
                  <Link
                    href={`/dashboard/${organization.slug}/sales/subscriptions/${grant.subscription_id}`}
                  >
                    <Button size="sm" variant="secondary">
                      View Subscription
                    </Button>
                  </Link>
                ) : (
                  <span className="text-gray-400">—</span>
                ),
            },
          ]}
        />
      )}
    </div>
  )
}
