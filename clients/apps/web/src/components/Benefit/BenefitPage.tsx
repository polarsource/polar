import { useGrantsForBenefit } from '@/hooks/queries/benefits'
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
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BenefitGrantStatus } from './BenefitGrantStatus'

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

  const { data: benefitGrants, isLoading } = useGrantsForBenefit({
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
            cell: ({ row: { original: grant } }) => (
              <BenefitGrantStatus grant={grant} />
            ),
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
