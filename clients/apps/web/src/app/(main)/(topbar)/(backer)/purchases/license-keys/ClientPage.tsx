'use client'

import { LicenseKeyActivations } from '@/components/Benefit/LicenseKeys/LicenseKeyActivations'
import { LicenseKeyDetails } from '@/components/Benefit/LicenseKeys/LicenseKeyDetails'
import Pagination from '@/components/Pagination/Pagination'
import { PurchasesQueryParametersContext } from '@/components/Purchases/PurchasesQueryParametersContext'
import PurchaseSidebar from '@/components/Purchases/PurchasesSidebar'
import { toast } from '@/components/Toast/use-toast'
import {
  useCustomerBenefitGrants,
  useCustomerLicenseKey,
} from '@/hooks/queries'
import { api } from '@/utils/client'
import { Key } from '@mui/icons-material'
import { BenefitType, CustomerBenefitGrantLicenseKeys } from '@polar-sh/api'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useContext, useMemo } from 'react'

export default function ClientPage() {
  const searchParams = useSearchParams()
  const [purchaseParameters, setPurchaseParameters] = useContext(
    PurchasesQueryParametersContext,
  )

  const onPageChange = useCallback(
    (page: number) => {
      setPurchaseParameters((prev) => ({
        ...prev,
        page,
      }))
    },
    [setPurchaseParameters],
  )

  const { data: benefitGrants } = useCustomerBenefitGrants(api, {
    limit: purchaseParameters.limit,
    page: purchaseParameters.page,
    type: BenefitType.LICENSE_KEYS,
  })

  return (
    <div className="flex h-full flex-col gap-12 md:flex-row">
      <div className="flex h-full w-full flex-shrink-0 flex-col gap-y-12 self-stretch md:sticky md:top-[3rem] md:max-w-xs">
        <PurchaseSidebar />
      </div>

      <div className="flex w-full flex-col gap-y-8">
        <div className="flex w-full flex-row items-center justify-between">
          <h3 className="text-2xl">License Keys</h3>
        </div>

        {benefitGrants?.pagination.total_count === 0 ? (
          <div className="flex h-full w-full flex-col items-center gap-y-4 py-32 text-6xl">
            <Key
              className="dark:text-polar-600 text-gray-400"
              fontSize="inherit"
            />
            <div className="flex flex-col items-center gap-y-2">
              <h3 className="p-2 text-xl font-medium">No License Keys found</h3>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-y-6">
            {benefitGrants?.items.map((benefitGrant) => (
              <LicenseKeyItem
                key={benefitGrant.id}
                benefitGrant={benefitGrant as CustomerBenefitGrantLicenseKeys}
              />
            ))}
            <Pagination
              currentPage={purchaseParameters.page}
              totalCount={benefitGrants?.pagination.total_count || 0}
              pageSize={purchaseParameters.limit}
              onPageChange={onPageChange}
              currentURL={searchParams}
            />
          </div>
        )}
      </div>
    </div>
  )
}

interface LicenseKeyItemProps {
  benefitGrant: CustomerBenefitGrantLicenseKeys
}

const LicenseKeyItem = ({ benefitGrant }: LicenseKeyItemProps) => {
  const { benefit } = benefitGrant
  const { data: licenseKey } = useCustomerLicenseKey(
    api,
    benefitGrant.properties.license_key_id as string,
  )

  const organizationLink = useMemo(() => {
    if (benefit.organization.profile_settings?.enabled) {
      return (
        <Link
          className="dark:text-polar-500 dark:hover:text-polar-200 text-sm text-gray-500 hover:text-gray-700"
          href={`/${benefit.organization.slug}`}
        >
          {benefit.organization.name}
        </Link>
      )
    }

    return (
      <span className="dark:text-polar-500 text-sm text-gray-500">
        {benefit.organization.name}
      </span>
    )
  }, [benefit])

  if (!benefit) return null

  return (
    <ShadowBox className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row items-center gap-x-2">
          <Avatar
            className="h-8 w-8 text-xs"
            name={benefit.organization.name}
            avatar_url={benefit.organization.avatar_url}
          />
          {organizationLink}
        </div>
        <span className="text-xl">{benefit?.description}</span>
      </div>
      {licenseKey && (
        <>
          <div className="flex flex-col gap-y-6">
            <CopyToClipboardInput
              value={licenseKey.key}
              onCopy={() => {
                toast({
                  title: 'Copied To Clipboard',
                  description: `License Key was copied to clipboard`,
                })
              }}
            />
            <LicenseKeyDetails licenseKey={licenseKey} />
          </div>
          <LicenseKeyActivations api={api} licenseKey={licenseKey} />
        </>
      )}
    </ShadowBox>
  )
}
