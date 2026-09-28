'use client'

import { LicenseKeyModal } from '@/components/Benefit/LicenseKeys/LicenseKeyModal'
import LicenseKeyStatusSelect, {
  LicenseKeyStatusFilter,
} from '@/components/Benefit/LicenseKeys/LicenseKeyStatusSelect'
import { LicenseKeysList } from '@/components/Benefit/LicenseKeys/LicenseKeysList'
import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { toast } from '@/components/Toast/use-toast'
import {
  useLicenseKey,
  useLicenseKeyRotate,
  useOrganizationLicenseKeys,
} from '@/hooks/queries'
import { useDataTableQueryState } from '@/hooks/useDataTableQueryState'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { getAPIParams } from '@/utils/datatable'
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
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useCallback, useState } from 'react'
import { BenefitPage } from './BenefitPage'

const filterParsers = {
  status: parseAsStringLiteral<LicenseKeyStatusFilter>([
    'any',
    'granted',
    'disabled',
    'revoked',
  ]).withDefault('any'),
  license_key_id: parseAsString,
}

export const LicenseKeysPage = ({
  organization,
  benefit,
}: {
  organization: schemas['Organization']
  benefit: schemas['Benefit']
}) => {
  const { pagination, setPagination, sorting, setSorting, resetPage } =
    useDataTableQueryState()

  const [{ status, license_key_id: deepLinkedLicenseKeyId }, setFilters] =
    useQueryStates(filterParsers)

  const [selectedLicenseKeyId, setSelectedLicenseKeyId] = useState<
    string | null
  >(deepLinkedLicenseKeyId ?? null)
  const [licenseKeyModalView, setLicenseKeyModalView] = useState<
    'details' | 'rotate' | null
  >(deepLinkedLicenseKeyId ? 'details' : null)

  const { data: licenseKeys, isLoading } = useOrganizationLicenseKeys({
    organization_id: organization.id,
    benefit_id: benefit.id,
    ...getAPIParams(pagination, sorting),
    ...(status !== 'any' ? { status } : {}),
  })

  const { data: selectedLicenseKey } = useLicenseKey(
    selectedLicenseKeyId ?? undefined,
  )

  const rotateLicenseKey = useLicenseKeyRotate(organization.id)

  const setDeepLinkParam = useCallback(
    (licenseKeyId: string | null) =>
      setFilters({ license_key_id: licenseKeyId }),
    [setFilters],
  )

  const setStatus = (status: LicenseKeyStatusFilter) => {
    setFilters({ status })
    resetPage()
  }

  const closeLicenseKeyModal = useCallback(() => {
    setLicenseKeyModalView(null)
    setSelectedLicenseKeyId(null)
    setDeepLinkParam(null)
  }, [setLicenseKeyModalView, setSelectedLicenseKeyId, setDeepLinkParam])

  const openRotateConfirm = useCallback(() => {
    if (rotateLicenseKey.isPending) {
      return
    }
    setLicenseKeyModalView('rotate')
  }, [rotateLicenseKey.isPending, setLicenseKeyModalView])

  const closeRotateConfirm = useCallback(() => {
    setLicenseKeyModalView((currentView) =>
      currentView === 'rotate' ? 'details' : currentView,
    )
  }, [setLicenseKeyModalView])

  const handleRotate = useCallback(async () => {
    if (!selectedLicenseKeyId || rotateLicenseKey.isPending) {
      return
    }

    const { error } = await rotateLicenseKey.mutateAsync(selectedLicenseKeyId)
    if (error) {
      toast({
        title: 'License Key Rotation Failed',
        description: extractApiErrorMessage(error),
      })
      return
    }

    toast({
      title: 'License Key Rotated',
      description:
        'The previous key no longer validates. Copy the new key and share it with your customer.',
    })
  }, [rotateLicenseKey, selectedLicenseKeyId])

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
              if (
                rotateLicenseKey.isPending ||
                licenseKeyModalView === 'rotate'
              ) {
                return
              }
              setSelectedLicenseKeyId(licenseKey.id)
              setDeepLinkParam(licenseKey.id)
              setLicenseKeyModalView('details')
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
            isShown={licenseKeyModalView === 'details'}
            hide={closeLicenseKeyModal}
          />
          <ConfirmModal
            isShown={licenseKeyModalView === 'rotate'}
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
