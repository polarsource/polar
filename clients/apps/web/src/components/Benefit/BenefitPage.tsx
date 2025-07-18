import { useBenefitGrants } from '@/hooks/queries/benefits'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  parseSearchParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
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
import { useRouter, useSearchParams } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

export interface BenefitPageProps {
  benefit: schemas['Benefit']
  organization: schemas['Organization']
}

export const BenefitPage = ({ benefit, organization }: BenefitPageProps) => {
  const searchParamsMap = useSearchParams()
  const searchParams = Object.fromEntries(searchParamsMap.entries())
  const { pagination, sorting } = parseSearchParams(searchParams)

  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    return params
  }

  const router = useRouter()

  const { data: benefitGrants, isLoading } = useBenefitGrants({
    benefitId: benefit.id,
    organizationId: organization.id,
    ...getAPIParams(pagination, sorting),
  })

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
      `/dashboard/${organization.slug}/benefits?benefitId=${benefit.id}&${getSearchParams(
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
      `/dashboard/${organization.slug}/benefits?benefitId=${benefit.id}&${getSearchParams(
        pagination,
        updatedSorting,
      )}`,
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl">Benefit Grants</h2>
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
            accessorKey: 'customer',
            header: 'Customer',
            cell: ({ row: { original: grant } }) => (
              <div className="flex items-center gap-3">
                <Avatar
                  className="h-10 w-10"
                  avatar_url={grant.customer.avatar_url}
                  name={grant.customer.name || grant.customer.email}
                />
                <div className="flex min-w-0 flex-col">
                  <div className="w-full truncate text-sm">
                    {grant.customer.name ?? '—'}
                  </div>
                  <div className="w-full truncate text-xs text-gray-500 dark:text-gray-500">
                    {grant.customer.email}
                  </div>
                </div>
              </div>
            ),
          },
          {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row: { original: grant } }) => {
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
            header: 'Created',
            cell: ({ row: { original: grant } }) => (
              <FormattedDateTime datetime={grant.created_at} />
            ),
          },
          {
            accessorKey: 'order',
            header: 'Order',
            cell: ({ row: { original: grant } }) =>
              grant.order_id ? (
                <Link
                  href={`/dashboard/${organization.slug}/sales/${grant.order_id}`}
                >
                  <Button size="sm" variant="secondary">
                    View Order
                  </Button>
                </Link>
              ) : (
                <></>
              ),
          },
        ]}
      />
    </div>
  )
}
