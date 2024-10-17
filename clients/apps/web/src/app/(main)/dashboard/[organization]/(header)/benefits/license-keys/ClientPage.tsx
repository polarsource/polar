'use client'

import { LicenseKeysList } from '@/components/Benefit/LicenseKeys/LicenseKeysList'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useOrganizationLicenseKeys } from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { Organization } from '@polar-sh/sdk'
import { PaginationState, SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'

export const ClientPage = ({
  organization,
  sorting,
  pagination,
}: {
  organization: Organization
  sorting: SortingState
  pagination: PaginationState
}) => {
  const { data: licenseKeys, isLoading } = useOrganizationLicenseKeys({
    organizationId: organization.id,
    ...getAPIParams(pagination, sorting),
  })

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
    <DashboardBody>
      <LicenseKeysList
        isLoading={isLoading}
        pageCount={licenseKeys?.pagination.max_page ?? 1}
        licenseKeys={licenseKeys?.items ?? []}
        pagination={pagination}
        sorting={sorting}
        setPagination={setPagination}
        setSorting={setSorting}
      />
    </DashboardBody>
  )
}
