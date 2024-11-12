'use client'

import { LicenseKeysList } from '@/components/Benefit/LicenseKeys/LicenseKeysList'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  useLicenseKey,
  useLicenseKeyDeactivation,
  useLicenseKeyUpdate,
  useOrganizationLicenseKeys,
} from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { CloseOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import {
  PaginationState,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useCallback, useMemo, useState } from 'react'

export const ClientPage = ({
  organization,
  sorting,
  pagination,
}: {
  organization: Organization
  sorting: SortingState
  pagination: PaginationState
}) => {
  const [statusLoading, setStatusLoading] = useState(false)
  const [selectedLicenseKeys, setSelectedLicenseKeys] =
    useState<RowSelectionState>({})

  const { data: licenseKeys, isLoading } = useOrganizationLicenseKeys({
    organizationId: organization.id,
    ...getAPIParams(pagination, sorting),
  })

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

  console.log(selectedLicenseKey)

  const LicenseKeyContextView = selectedLicenseKey ? (
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
        <ShadowBox className="dark:bg-polar-800 bg-white p-6 text-sm lg:rounded-3xl">
          <div className="flex flex-col gap-y-6">
            <div className="flex flex-col gap-y-2">
              <div className="flex flex-row items-center justify-between">
                <span className="dark:text-polar-500 text-gray-500">
                  Status
                </span>
                <span className="capitalize">{selectedLicenseKey.status}</span>
              </div>
              {selectedLicenseKey.limit_usage && (
                <div className="flex flex-row items-center justify-between">
                  <span className="dark:text-polar-500 text-gray-500">
                    Usage
                  </span>
                  <span>
                    {selectedLicenseKey.usage} /{' '}
                    {selectedLicenseKey.limit_usage}
                  </span>
                </div>
              )}
              <div className="flex flex-row items-center justify-between">
                <span className="dark:text-polar-500 text-gray-500">
                  Validations
                </span>
                <span>{selectedLicenseKey.validations}</span>
              </div>
              <div className="flex flex-row items-center justify-between">
                <span className="dark:text-polar-500 text-gray-500">
                  Validated At
                </span>
                <span>
                  {selectedLicenseKey.last_validated_at ? (
                    <FormattedDateTime
                      datetime={selectedLicenseKey.last_validated_at ?? ''}
                    />
                  ) : (
                    <span>Never Validated</span>
                  )}
                </span>
              </div>
              <div className="flex flex-row items-center justify-between">
                <span className="dark:text-polar-500 text-gray-500">
                  Expiry Date
                </span>
                <span>
                  {selectedLicenseKey.expires_at ? (
                    <FormattedDateTime
                      datetime={selectedLicenseKey.expires_at ?? ''}
                    />
                  ) : (
                    <span>No Expiry</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </ShadowBox>
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
    <DashboardBody contextView={LicenseKeyContextView}>
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

interface LicenseKeyActivationsProps {
  licenseKeyId: string
}

const LicenseKeyActivations = ({
  licenseKeyId,
}: LicenseKeyActivationsProps) => {
  const { data: licenseKey } = useLicenseKey({ licenseKeyId })

  const onDeactivate = useLicenseKeyDeactivation(licenseKeyId)

  const hasActivations = (licenseKey?.activations?.length ?? 0) > 0

  if (!hasActivations) {
    return null
  }

  return (
    <div className="flex flex-col gap-y-4">
      <h3>Activations</h3>
      <List size="small">
        {licenseKey?.activations.map((activation) => (
          <ListItem key={activation.id} size="small">
            <h3 className="text-sm">{activation.label}</h3>
            <div className="flex flex-row items-center gap-x-4">
              <span className="dark:text-polar-500 text-sm text-gray-500">
                <FormattedDateTime datetime={activation.created_at} />
              </span>
              <Button
                className="h-6 w-6"
                variant="secondary"
                size="icon"
                onClick={() => {
                  onDeactivate.mutate({
                    activationId: activation.id,
                    key: licenseKey.key,
                    organizationId: licenseKey.organization_id,
                  })
                }}
              >
                <CloseOutlined fontSize="inherit" />
              </Button>
            </div>
          </ListItem>
        ))}
      </List>
    </div>
  )
}
