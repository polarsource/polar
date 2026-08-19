'use client'

import { LicenseKeyModal } from '@/components/Benefit/LicenseKeys/LicenseKeyModal'
import LicenseKeyStatusSelect from '@/components/Benefit/LicenseKeys/LicenseKeyStatusSelect'
import { LicenseKeysList } from '@/components/Benefit/LicenseKeys/LicenseKeysList'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { toast } from '@/components/Toast/use-toast'
import {
  useLicenseKey,
  useLicenseKeyRotate,
  useOrganizationLicenseKeys,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import {
  DataTablePaginationState,
  DataTableSortingState,
  getAPIParams,
  parseSearchParams,
  serializeSearchParams,
} from '@/utils/datatable'
import { schemas } from '@polar-sh/client'
import {
  InlineModal,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
} from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
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
  const status = searchParams['status'] ?? 'any'
  const deepLinkedLicenseKeyId = searchParams['license_key_id']

  const [selectedLicenseKeyId, setSelectedLicenseKeyId] = useState<
    string | null
  >(deepLinkedLicenseKeyId ?? null)

  const { data: licenseKeys, isLoading } = useOrganizationLicenseKeys({
    organization_id: organization.id,
    benefit_id: benefit.id,
    ...getAPIParams(pagination, sorting),
    ...(status !== 'any'
      ? { status: status as schemas['LicenseKeyStatus'] }
      : {}),
  })

  const { data: selectedLicenseKey } = useLicenseKey(
    selectedLicenseKeyId ?? undefined,
  )

  const getSearchParams = (
    pagination: DataTablePaginationState,
    sorting: DataTableSortingState,
    status: string,
  ) => {
    const params = serializeSearchParams(pagination, sorting)
    if (status !== 'any') {
      params.append('status', status)
    }
    if (deepLinkedLicenseKeyId) {
      params.append('license_key_id', deepLinkedLicenseKeyId)
    }
    return params
  }

  const {
    isShown: isLicenseKeyModalShown,
    show: showLicenseKeyModal,
    hide: hideLicenseKeyModal,
  } = useModal(!!deepLinkedLicenseKeyId)
  const {
    isShown: isRotateConfirmShown,
    show: showRotateConfirm,
    hide: hideRotateConfirm,
  } = useModal()
  const rotateLicenseKey = useLicenseKeyRotate(organization.id)
  const isRotatingRef = useRef(false)

  const router = useRouter()

  const setDeepLinkParam = useCallback(
    (licenseKeyId: string | null) => {
      const params = new URLSearchParams(searchParamsMap.toString())
      if (licenseKeyId) {
        params.set('license_key_id', licenseKeyId)
      } else {
        params.delete('license_key_id')
      }
      const query = params.toString()
      router.replace(
        `/dashboard/${organization.slug}/products/benefits/${benefit.id}${
          query ? `?${query}` : ''
        }`,
      )
    },
    [searchParamsMap, router, organization.slug, benefit.id],
  )

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
        status,
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
        status,
      )}`,
    )
  }

  const setStatus = (status: string) => {
    router.push(
      `/dashboard/${organization.slug}/products/benefits/${benefit.id}?${getSearchParams(
        pagination,
        sorting,
        status,
      )}`,
    )
  }

  const closeLicenseKeyModal = useCallback(() => {
    hideLicenseKeyModal()
    setSelectedLicenseKeyId(null)
    setDeepLinkParam(null)
  }, [hideLicenseKeyModal, setSelectedLicenseKeyId, setDeepLinkParam])

  const openRotateConfirm = useCallback(() => {
    hideLicenseKeyModal()
    showRotateConfirm()
  }, [hideLicenseKeyModal, showRotateConfirm])

  const closeRotateConfirm = useCallback(() => {
    hideRotateConfirm()
    if (!isRotatingRef.current) {
      window.setTimeout(showLicenseKeyModal, 0)
    }
  }, [hideRotateConfirm, showLicenseKeyModal])

  const handleRotate = useCallback(async () => {
    if (!selectedLicenseKeyId) {
      return
    }

    isRotatingRef.current = true
    try {
      const { error } = await rotateLicenseKey.mutateAsync(selectedLicenseKeyId)
      if (error) {
        toast({
          title: 'License Key Rotation Failed',
          description: extractApiErrorMessage(error),
        })
      } else {
        toast({
          title: 'License Key Rotated',
          description:
            'The previous key no longer validates. Copy the new key and share it with your customer.',
        })
      }
    } finally {
      isRotatingRef.current = false
      showLicenseKeyModal()
    }
  }, [rotateLicenseKey, selectedLicenseKeyId, showLicenseKeyModal])

  return (
    <Tabs defaultValue="license-keys">
      <TabsList className="mb-8">
        <TabsTrigger value="license-keys">License Keys</TabsTrigger>
        <TabsTrigger value="grants">Grants</TabsTrigger>
      </TabsList>
      <TabsContent value="license-keys">
        <Box flexDirection="column" rowGap="xl">
          <Box alignItems="center" justifyContent="between" gap="l">
            <Text variant="heading-xxs" as="h2">
              License Keys
            </Text>
            <Box width="auto">
              <LicenseKeyStatusSelect
                statuses={['granted', 'disabled', 'revoked']}
                value={status}
                onChange={setStatus}
              />
            </Box>
          </Box>
          <LicenseKeysList
            isLoading={isLoading}
            rowCount={licenseKeys?.pagination.total_count ?? 0}
            pageCount={licenseKeys?.pagination.max_page ?? 1}
            licenseKeys={licenseKeys?.items ?? []}
            pagination={pagination}
            sorting={sorting}
            setPagination={setPagination}
            setSorting={setSorting}
            onSelectLicenseKey={(licenseKey) => {
              setSelectedLicenseKeyId(licenseKey.id)
              setDeepLinkParam(licenseKey.id)
              showLicenseKeyModal()
            }}
            selectedLicenseKeyId={selectedLicenseKeyId}
          />
          <InlineModal
            modalContent={
              selectedLicenseKey ? (
                <LicenseKeyModal
                  organization={organization}
                  licenseKey={selectedLicenseKey}
                  onClose={closeLicenseKeyModal}
                  onRotate={openRotateConfirm}
                />
              ) : null
            }
            isShown={isLicenseKeyModalShown}
            hide={closeLicenseKeyModal}
          />
          <ConfirmModal
            isShown={isRotateConfirmShown}
            hide={closeRotateConfirm}
            title="Rotate this license key?"
            description="A new key will be generated for this customer. The previous key stops validating immediately. Share the new key with your customer, or have them copy it from the customer portal."
            destructive
            destructiveText="Rotate"
            onConfirm={handleRotate}
          />
        </Box>
      </TabsContent>
      <TabsContent value="grants">
        <BenefitPage benefit={benefit} organization={organization} />
      </TabsContent>
    </Tabs>
  )
}
