'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MetersList } from '@/components/Meter/MetersList'
import { useMeters } from '@/hooks/queries/meters'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import {
  DataTablePaginationState,
  DataTableSortingState,
  serializeSearchParams,
} from '@/utils/datatable'
import { AddOutlined } from '@mui/icons-material'
import { PaginationState, SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { useContext } from 'react'

const ClientPage = ({
  sorting,
  pagination,
}: {
  sorting: SortingState
  pagination: PaginationState
}) => {
  const { organization } = useContext(MaintainerOrganizationContext)

  const { data: meters, isLoading } = useMeters(organization?.id)

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
      `/dashboard/${organization.slug}/benefits/license-keys?${getSearchParams(
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
      `/dashboard/${organization.slug}/benefits/license-keys?${getSearchParams(
        pagination,
        updatedSorting,
      )}`,
    )
  }

  return (
    <DashboardBody
      header={
        <Button wrapperClassNames="flex items-center flex-row gap-x-1">
          <AddOutlined fontSize="small" />
          <span>New Meter</span>
        </Button>
      }
    >
      <MetersList
        meters={meters?.items ?? []}
        pageCount={meters?.pagination.max_page ?? 1}
        pagination={pagination}
        setPagination={setPagination}
        setSorting={setSorting}
        sorting={sorting}
        isLoading={isLoading}
      />
    </DashboardBody>
  )
}

export default ClientPage
