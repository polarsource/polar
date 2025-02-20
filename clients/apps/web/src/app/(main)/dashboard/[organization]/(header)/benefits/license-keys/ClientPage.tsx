'use client'

import { LicenseKeyDetails } from '@/components/Benefit/LicenseKeys/LicenseKeyDetails'
import { LicenseKeysList } from '@/components/Benefit/LicenseKeys/LicenseKeysList'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { toast } from '@/components/Toast/use-toast'
import {
  useBenefits,
  useLicenseKey,
  useLicenseKeyUpdate,
  useOrganizationLicenseKeys,
} from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import {
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

export const ClientPage = ({
  organization,
  sorting,
  pagination,
}: {
  organization: schemas['Organization']
  sorting: SortingState
  pagination: PaginationState
}) => {
  const [selectedBenefitId, setSelectedBenefitId] = useState<
    string | undefined
  >()
  const [statusLoading, setStatusLoading] = useState(false)
  const [selectedLicenseKeys, setSelectedLicenseKeys] =
    useState<RowSelectionState>({})

  const { data: licenseKeys, isLoading } = useOrganizationLicenseKeys({
    organization_id: organization.id,
    benefit_id: selectedBenefitId,
    ...getAPIParams(pagination, sorting),
  })

  const { data: licenseKeyBenefits } = useBenefits(
    organization.id,
    100,
    'license_keys',
  )

  const { data: selectedLicenseKey } = useLicenseKey(
    Object.keys(selectedLicenseKeys)[0],
  )

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

  const updateLicenseKey = useLicenseKeyUpdate(organization.id)

  const handleToggleLicenseKeyStatus = useCallback(
    async (status: 'granted' | 'disabled' | 'revoked') => {
      if (selectedLicenseKey) {
        setStatusLoading(true)

        await updateLicenseKey
          .mutateAsync(
            {
              id: selectedLicenseKey.id,
              body: {
                status,
                usage: selectedLicenseKey.usage,
              },
            },
            {
              onSettled: () => {
                setStatusLoading(false)
              },
            },
          )
          .then(({ error }) => {
            if (error) {
              toast({
                title: 'License Key Status Update Failed',
                description: `Error updating license key status to ${status}: ${error.detail}`,
              })
              return
            }
            toast({
              title: 'License Key Status Updated',
              description: `License key ending in ${selectedLicenseKey.display_key} updated to ${status}`,
            })
          })
      }
    },
    [updateLicenseKey, selectedLicenseKey, setStatusLoading],
  )

  const LicenseKeyContextView = selectedLicenseKey ? (
    <div className="flex flex-col gap-y-8 p-8">
      <h1 className="text-xl">License Key</h1>
      <div className="flex flex-row items-center gap-x-3">
        <Avatar
          className="h-10 w-10"
          avatar_url={selectedLicenseKey.customer.avatar_url}
          name={selectedLicenseKey.customer.email}
        />
        <div className="flex flex-col">
          <span>{selectedLicenseKey.user?.public_name}</span>
          <span className="dark:text-polar-500 text-xs text-gray-500">
            {selectedLicenseKey.user?.email}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-y-6">
        <CopyToClipboardInput
          value={selectedLicenseKey.key}
          onCopy={() => {
            toast({
              title: 'Copied To Clipboard',
              description: `License Key was copied to clipboard`,
            })
          }}
        />
        <LicenseKeyDetails licenseKey={selectedLicenseKey} />
      </div>
      <div className="flex flex-row gap-x-4">
        {['disabled', 'revoked'].includes(selectedLicenseKey.status) && (
          <Button
            onClick={() => handleToggleLicenseKeyStatus('granted')}
            loading={statusLoading}
          >
            Enable
          </Button>
        )}
        {selectedLicenseKey.status === 'granted' && (
          <Button
            onClick={() => handleToggleLicenseKeyStatus('disabled')}
            variant="secondary"
            loading={statusLoading}
          >
            Disable
          </Button>
        )}
        {selectedLicenseKey.status === 'granted' && (
          <Button
            onClick={() => handleToggleLicenseKeyStatus('revoked')}
            loading={statusLoading}
            variant="destructive"
          >
            Revoke
          </Button>
        )}
      </div>
    </div>
  ) : undefined

  return (
    <DashboardBody
      className="flex flex-col gap-y-6"
      contextView={LicenseKeyContextView}
      wide
    >
      <Select
        defaultValue="all"
        onValueChange={(value) => {
          setSelectedBenefitId(value != 'all' ? value : undefined)
        }}
      >
        <SelectTrigger className="w-fit min-w-64">
          <SelectValue placeholder="Filter by Benefit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem key="all" value="all">
            All License Keys
          </SelectItem>
          {licenseKeyBenefits?.items.map((benefit) => (
            <SelectItem key={benefit.id} value={benefit.id}>
              {benefit.description}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <LicenseKeysList
        isLoading={isLoading}
        pageCount={licenseKeys?.pagination.max_page ?? 1}
        licenseKeys={licenseKeys?.items ?? []}
        pagination={pagination}
        sorting={sorting}
        setPagination={setPagination}
        setSorting={setSorting}
        onSelectLicenseKeyChange={setSelectedLicenseKeys}
        selectedLicenseKey={selectedLicenseKeys}
      />
    </DashboardBody>
  )
}
