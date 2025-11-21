'use client'

import { LicenseKeyDetails } from '@/components/Benefit/LicenseKeys/LicenseKeyDetails'
import { LicenseKeysList } from '@/components/Benefit/LicenseKeys/LicenseKeysList'
import { toast } from '@/components/Toast/use-toast'
import {
  useLicenseKey,
  useLicenseKeyUpdate,
  useOrganizationLicenseKeys,
} from '@/hooks/queries'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  parseSearchParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Button from '@polar-sh/ui/components/atoms/Button'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@polar-sh/ui/components/atoms/Tabs'
import { RowSelectionState } from '@tanstack/react-table'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { InlineModal } from '../Modal/InlineModal'
import { useModal } from '../Modal/useModal'
import { BenefitPage } from './BenefitPage'

export const LicenseKeysPage = ({
  organization,
  benefit,
}: {
  organization: schemas['Organization']
  benefit: schemas['Benefit']
}) => {
  const searchParamsMap = useSearchParams()
  const searchParams = Object.fromEntries(searchParamsMap.entries())
  const { pagination, sorting } = parseSearchParams(searchParams)

  const [statusLoading, setStatusLoading] = useState(false)
  const [selectedLicenseKeys, setSelectedLicenseKeys] =
    useState<RowSelectionState>({})

  const { data: licenseKeys, isLoading } = useOrganizationLicenseKeys({
    organization_id: organization.id,
    benefit_id: benefit.id,
    ...getAPIParams(pagination, sorting),
  })

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

  const {
    isShown: isLicenseKeyModalShown,
    show: showLicenseKeyModal,
    hide: hideLicenseKeyModal,
  } = useModal()

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
      `/dashboard/${organization.slug}/products/benefits/${benefit.id}?${getSearchParams(
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
      `/dashboard/${organization.slug}/products/benefits/${benefit.id}?${getSearchParams(
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
          <span>{selectedLicenseKey.customer.email}</span>
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
    <Tabs defaultValue="license-keys">
      <TabsList className="mb-8">
        <TabsTrigger value="license-keys">License Keys</TabsTrigger>
        <TabsTrigger value="grants">Grants</TabsTrigger>
      </TabsList>
      <TabsContent value="license-keys">
        <div className="flex flex-col gap-y-6">
          <h2 className="text-xl">License Keys</h2>
          <LicenseKeysList
            isLoading={isLoading}
            rowCount={licenseKeys?.pagination.total_count ?? 0}
            pageCount={licenseKeys?.pagination.max_page ?? 1}
            licenseKeys={licenseKeys?.items ?? []}
            pagination={pagination}
            sorting={sorting}
            setPagination={setPagination}
            setSorting={setSorting}
            onSelectLicenseKeyChange={(selectedLicenseKeys) => {
              setSelectedLicenseKeys(selectedLicenseKeys)

              showLicenseKeyModal()
            }}
            selectedLicenseKey={selectedLicenseKeys}
          />
          <InlineModal
            modalContent={LicenseKeyContextView ?? <></>}
            isShown={isLicenseKeyModalShown}
            hide={() => {
              hideLicenseKeyModal()
              setSelectedLicenseKeys({})
            }}
          />
        </div>
      </TabsContent>
      <TabsContent value="grants">
        <BenefitPage benefit={benefit} organization={organization} />
      </TabsContent>
    </Tabs>
  )
}
