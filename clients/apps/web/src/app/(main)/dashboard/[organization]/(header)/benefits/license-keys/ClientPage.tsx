'use client'

import { LicenseKeyActivations } from '@/components/Benefit/LicenseKeys/LicenseKeyActivations'
import { LicenseKeyDetails } from '@/components/Benefit/LicenseKeys/LicenseKeyDetails'
import { LicenseKeysList } from '@/components/Benefit/LicenseKeys/LicenseKeysList'
import { InlineModal } from '@/components/Modal/InlineModal'
import { useModal } from '@/components/Modal/useModal'
import {
  useBenefits,
  useLicenseKeyUpdate,
  useOrganizationLicenseKeys,
} from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { Organization } from '@polar-sh/sdk'
import {
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import { useCallback, useMemo, useState } from 'react'

export const ClientPage = ({
  organization,
  sorting,
  pagination,
  selectedBenefitId,
}: {
  organization: Organization
  sorting: SortingState
  pagination: PaginationState
  selectedBenefitId: string | undefined
}) => {
  const [statusLoading, setStatusLoading] = useState(false)
  const [selectedLicenseKeys, setSelectedLicenseKeys] =
    useState<RowSelectionState>({})

  const {
    isShown: isModalShown,
    toggle: toggleModal,
    hide: hideModal,
  } = useModal(!!selectedBenefitId)

  const { data: licenseKeys, isLoading } = useOrganizationLicenseKeys({
    organizationId: organization.id,
    benefitId: selectedBenefitId,
    ...getAPIParams(pagination, sorting),
  })

  const { data: licenseKeyBenefits } = useBenefits(
    organization.id,
    100,
    'license_keys',
  )

  const selectedLicenseKey = useMemo(() => {
    const selectedLicenseKeyIds = Object.keys(selectedLicenseKeys)
    const key = licenseKeys?.items.find(
      (licenseKey) => licenseKey.id === selectedLicenseKeyIds[0],
    )
    return key
  }, [selectedLicenseKeys, licenseKeys])

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
    (status: 'granted' | 'disabled' | 'revoked') => {
      if (selectedLicenseKey) {
        setStatusLoading(true)

        updateLicenseKey.mutate(
          {
            id: selectedLicenseKey.id,
            body: {
              status,
            },
          },
          {
            onSettled: () => {
              setStatusLoading(false)
            },
          },
        )
      }
    },
    [updateLicenseKey, selectedLicenseKey, setStatusLoading],
  )

  const LicenseKeyContextView = () =>
    selectedLicenseKey ? (
      <div className="flex flex-col gap-y-8 p-8">
        <h1 className="text-xl">License Key</h1>
        <div className="flex flex-row items-center gap-x-3">
          <Avatar
            className="h-10 w-10"
            avatar_url={selectedLicenseKey.user?.avatar_url}
            name={selectedLicenseKey.user?.public_name}
          />
          <div className="flex flex-col">
            <span>{selectedLicenseKey.user?.public_name}</span>
            <span className="dark:text-polar-500 text-xs text-gray-500">
              {selectedLicenseKey.user?.email}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-y-6">
          <CopyToClipboardInput value={selectedLicenseKey.key} />
          <LicenseKeyDetails licenseKey={selectedLicenseKey} />
        </div>
        <LicenseKeyActivations licenseKeyId={selectedLicenseKey.id} />
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
    <>
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
      <InlineModal
        isShown={isModalShown}
        hide={hideModal}
        modalContent={<LicenseKeyContextView />}
      />
    </>
  )
}
