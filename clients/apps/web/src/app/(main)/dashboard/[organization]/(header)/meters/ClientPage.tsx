'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { MeterCreationModal } from '@/components/Meter/MeterCreationModal'
import { MetersList } from '@/components/Meter/MetersList'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import { useMeters } from '@/hooks/queries/meters'
import {
  DataTablePaginationState,
  DataTableSortingState,
  serializeSearchParams,
} from '@/utils/datatable'
import { AddOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

const ClientPage = ({
  sorting,
  pagination,
  organization,
}: {
  sorting: SortingState
  pagination: PaginationState
  organization: schemas['Organization']
}) => {
  const router = useRouter()
  const { data: meters, isLoading } = useMeters(organization?.id)
  const [selectedMeterState, setSelectedMeterState] =
    useState<RowSelectionState>({})

  const {
    isShown: isMeterModalShown,
    hide: hideMeterModal,
    show: showMeterModal,
  } = useModal()

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
        <Button
          wrapperClassNames="flex items-center flex-row gap-x-2"
          onClick={showMeterModal}
        >
          <AddOutlined fontSize="inherit" />
          <span>New Meter</span>
        </Button>
      }
      wide
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
      <InlineModal
        isShown={isMeterModalShown}
        hide={hideMeterModal}
        modalContent={<MeterCreationModal hide={hideMeterModal} />}
      />
    </DashboardBody>
  )
}

export default ClientPage
