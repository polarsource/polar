'use client'

import CopyToClipboardButton from '@/components/CopyToClipboardButton/CopyToClipboardButton'
import CustomFieldTypeLabel from '@/components/CustomFields/CustomFieldTypeLabel'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { useCustomFields } from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { CustomField, CustomFieldType, Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import React from 'react'

interface ClientPageProps {
  organization: Organization
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  type?: CustomFieldType
}

const ClientPage: React.FC<ClientPageProps> = ({
  organization,
  pagination,
  sorting,
  type,
}) => {
  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    type?: CustomFieldType,
  ) => {
    const params = serializeSearchParams(pagination, sorting)

    if (type) {
      params.append('type', type)
    }

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
      `/dashboard/${organization.slug}/custom-fields?${getSearchParams(
        updatedPagination,
        sorting,
        type,
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
      `/dashboard/${organization.slug}/custom-fields?${getSearchParams(
        pagination,
        updatedSorting,
        type,
      )}`,
    )
  }

  const customFieldsHook = useCustomFields(organization.id, {
    ...getAPIParams(pagination, sorting),
    type,
  })

  const customFields = customFieldsHook.data?.items || []
  const pageCount = customFieldsHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<CustomField>[] = [
    {
      accessorKey: 'slug',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Slug" />
      ),
      cell: ({ getValue }) => {
        const value = getValue() as string
        return (
          <div className="flex flex-row items-center gap-1">
            <div className="font-mono">{value}</div>
            <CopyToClipboardButton text={value} />
          </div>
        )
      },
    },
    {
      accessorKey: 'name',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ getValue }) => {
        return <>{getValue()}</>
      },
    },
    {
      accessorKey: 'type',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ getValue }) => {
        return <CustomFieldTypeLabel type={getValue() as CustomFieldType} />
      },
    },
  ]

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        {customFields && pageCount !== undefined && (
          <DataTable
            columns={columns}
            data={customFields}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
            isLoading={customFieldsHook.isLoading}
          />
        )}
      </div>
    </DashboardBody>
  )
}

export default ClientPage
