'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MetersList } from '@/components/Meter/MetersList'
import { useMeters } from '@/hooks/queries/meters'
import {
  DataTablePaginationState,
  DataTableSortingState,
  serializeSearchParams,
} from '@/utils/datatable'
import { AddOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import {
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { useEffect, useMemo, useState } from 'react'

const ClientPage = ({
  sorting,
  pagination,
  organization,
}: {
  sorting: SortingState
  pagination: PaginationState
  organization: Organization
}) => {
  const router = useRouter()

  const { data: meters, isLoading } = useMeters(organization?.id)

  const [selectedMeterState, setSelectedMeterState] =
    useState<RowSelectionState>({})

  const selectedMeter = useMemo(() => {
    return meters?.items.find((meter) => selectedMeterState[meter.id])
  }, [meters, selectedMeterState])

  useEffect(() => {
    if (selectedMeter) {
      router.push(`/dashboard/${organization.slug}/meters/${selectedMeter.id}`)
    }
  }, [selectedMeter, router, organization])

  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    return params
  }

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
      `/dashboard/${organization.slug}/meters?${getSearchParams(
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
      `/dashboard/${organization.slug}/meters?${getSearchParams(
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
        selectedMeterState={selectedMeterState}
        setSelectedMeterState={setSelectedMeterState}
      />
    </DashboardBody>
  )
}

export default ClientPage
