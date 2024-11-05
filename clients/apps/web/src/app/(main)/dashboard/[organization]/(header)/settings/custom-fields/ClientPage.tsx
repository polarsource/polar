'use client'

import CopyToClipboardButton from '@/components/CopyToClipboardButton/CopyToClipboardButton'
import CreateCustomFieldModalContent from '@/components/CustomFields/CreateCustomFieldModalContent'
import CustomFieldTypeLabel from '@/components/CustomFields/CustomFieldTypeLabel'
import UpdateCustomFieldModalContent from '@/components/CustomFields/UpdateCustomFieldModalContent'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useCustomFields, useDeleteCustomField } from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { AddOutlined, MoreVertOutlined } from '@mui/icons-material'
import { CustomField, CustomFieldType, Organization } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from 'polarkit/components/ui/atoms/datatable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'polarkit/components/ui/dropdown-menu'
import React, { useCallback, useState } from 'react'

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
  const router = useRouter()

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
    {
      id: 'actions',
      enableSorting: false,
      cell: ({ row: { original: customField } }) => (
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
                <MoreVertOutlined fontSize="inherit" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="dark:bg-polar-800 bg-gray-50 shadow-lg"
            >
              <DropdownMenuItem
                onClick={() => onCustomFieldSelected(customField)}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteCustomField.mutate(customField)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const [showNewModal, setShowNewModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [selectedCustomField, setSelectedCustomField] = useState<CustomField>()
  const onCustomFieldSelected = useCallback((customField: CustomField) => {
    setSelectedCustomField(customField)
    setShowUpdateModal(true)
  }, [])
  const deleteCustomField = useDeleteCustomField()

  return (
    <DashboardBody>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-end gap-2">
          <Button type="button" onClick={() => setShowNewModal(true)}>
            <AddOutlined className="h-4 w-4" />
            <span>New Custom Field</span>
          </Button>
        </div>
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
      <InlineModal
        isShown={showNewModal}
        hide={() => setShowNewModal(false)}
        modalContent={
          <CreateCustomFieldModalContent
            organization={organization}
            onCustomFieldCreated={() => setShowNewModal(false)}
            hideModal={() => setShowNewModal(false)}
          />
        }
      />
      <InlineModal
        isShown={showUpdateModal}
        hide={() => setShowUpdateModal(false)}
        modalContent={
          selectedCustomField ? (
            <UpdateCustomFieldModalContent
              customField={selectedCustomField}
              onCustomFieldUpdated={() => setShowUpdateModal(false)}
              hideModal={() => setShowUpdateModal(false)}
            />
          ) : (
            <></>
          )
        }
      />
    </DashboardBody>
  )
}

export default ClientPage
