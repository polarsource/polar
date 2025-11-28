'use client'

import CreateCustomFieldModalContent from '@/components/CustomFields/CreateCustomFieldModalContent'
import CustomFieldTypeLabel from '@/components/CustomFields/CustomFieldTypeLabel'
import UpdateCustomFieldModalContent from '@/components/CustomFields/UpdateCustomFieldModalContent'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { InlineModal } from '@/components/Modal/InlineModal'
import { toast } from '@/components/Toast/use-toast'
import { useCustomFields, useDeleteCustomField } from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import AddOutlined from '@mui/icons-material/AddOutlined'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import {
  DataTable,
  DataTableColumnDef,
  DataTableColumnHeader,
} from '@polar-sh/ui/components/atoms/DataTable'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import React, { useCallback, useState } from 'react'

interface ClientPageProps {
  organization: schemas['Organization']
  pagination: DataTablePaginationState
  sorting: DataTableSortingState
  type?: schemas['CustomFieldType']
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
    type?: schemas['CustomFieldType'],
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

  const [showNewModal, setShowNewModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [selectedCustomField, setSelectedCustomField] =
    useState<schemas['CustomField']>()
  const onCustomFieldSelected = useCallback(
    (customField: schemas['CustomField']) => {
      setSelectedCustomField(customField)
      setShowUpdateModal(true)
    },
    [],
  )
  const deleteCustomField = useDeleteCustomField()

  const handleDeleteCustomField = useCallback(
    (customField: schemas['CustomField']) => () => {
      deleteCustomField.mutateAsync(customField).then(({ error }) => {
        if (error) {
          toast({
            title: 'Custom Field Deletion Failed',
            description: `Error deleting custom field ${customField.name}: ${error.detail}`,
          })
        }
        toast({
          title: 'Custom Field Deleted',
          description: `Custom field ${customField.name} successfully deleted`,
        })
      })
    },
    [deleteCustomField],
  )

  const customFieldsHook = useCustomFields(organization.id, {
    ...getAPIParams(pagination, sorting),
    type,
  })

  const customFields = customFieldsHook.data?.items || []
  const rowCount = customFieldsHook.data?.pagination.total_count ?? 0
  const pageCount = customFieldsHook.data?.pagination.max_page ?? 1

  const columns: DataTableColumnDef<schemas['CustomField']>[] = [
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
            <span>{value}</span>
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
        return <>{getValue() as string}</>
      },
    },
    {
      accessorKey: 'type',
      enableSorting: true,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ getValue }) => {
        return (
          <CustomFieldTypeLabel
            type={getValue() as schemas['CustomFieldType']}
          />
        )
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
              <DropdownMenuItem onClick={handleDeleteCustomField(customField)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  return (
    <DashboardBody
      header={
        <Button
          wrapperClassNames="flex flex-row gap-x-2"
          type="button"
          onClick={() => setShowNewModal(true)}
        >
          <AddOutlined className="h-4 w-4" />
          <span>New Custom Field</span>
        </Button>
      }
      wide
    >
      <div className="flex flex-col gap-8">
        {customFields && pageCount !== undefined && (
          <DataTable
            columns={columns}
            data={customFields}
            rowCount={rowCount}
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
