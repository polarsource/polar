'use client'

import { DownloadableItem as InnerDownloadableItem } from '@/components/Benefit/Downloadables/DownloadablesBenefitGrant'
import Pagination from '@/components/Pagination/Pagination'
import { PurchasesQueryParametersContext } from '@/components/Purchases/PurchasesQueryParametersContext'
import PurchaseSidebar from '@/components/Purchases/PurchasesSidebar'
import { toast } from '@/components/Toast/use-toast'
import {
  useCustomerBenefitGrants,
  useCustomerDownloadables,
} from '@/hooks/queries'
import { api } from '@/utils/client'
import { FileDownloadOutlined } from '@mui/icons-material'
import { schemas } from '@polar-sh/client'
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

  const { data: downloadables } = useCustomerDownloadables(api, {
    limit: purchaseParameters.limit,
    page: purchaseParameters.page,
  })

  return (
    <div className="flex h-full flex-col gap-12 md:flex-row">
      <div className="flex h-full w-full flex-shrink-0 flex-col gap-y-12 self-stretch md:sticky md:top-[3rem] md:max-w-xs">
        <PurchaseSidebar />
      </div>

      <div className="flex w-full flex-col gap-y-8">
        <div className="flex w-full flex-row items-center justify-between">
          <h3 className="text-2xl">File Downloads</h3>
        </div>

        {downloadables?.pagination.total_count === 0 ? (
          <div className="flex h-full w-full flex-col items-center gap-y-4 py-32 text-6xl">
            <FileDownloadOutlined
              className="dark:text-polar-600 text-gray-400"
              fontSize="inherit"
            />
            <div className="flex flex-col items-center gap-y-2">
              <h3 className="p-2 text-xl font-medium">
                No File Downloads found
              </h3>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-y-6">
            {downloadables?.items.map((downloadable) => (
              <DownloadableItem
                key={downloadable.id}
                downloadable={downloadable}
              />
            ))}
            <Pagination
              currentPage={purchaseParameters.page}
              totalCount={downloadables?.pagination.total_count || 0}
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

interface DownloadableItemProps {
  downloadable: schemas['DownloadableRead']
}

const DownloadableItem = ({ downloadable }: DownloadableItemProps) => {
  const { data: benefitGrants } = useCustomerBenefitGrants(api, {
    limit: 1,
    benefit_id: downloadable.benefit_id,
  })
  const benefitGrant = benefitGrants?.items[0]
  const benefit = benefitGrant?.benefit

  const organizationLink = useMemo(() => {
    if (benefit?.organization.profile_settings?.enabled) {
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
        {benefit?.organization.name}
      </span>
    )
  }, [benefit])

  if (!benefit) return null

  return (
    <ShadowBox className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-2">
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
      <InnerDownloadableItem
        className="dark:border-polar-700 border border-gray-200"
        downloadable={downloadable}
        historic={false}
        showActions={false}
        fileIcon
      />
      <div className="flex flex-col gap-y-2">
        <span className="text-sm">SHA256 Checksum</span>
        <CopyToClipboardInput
          value={downloadable.file.checksum_sha256_hex ?? ''}
          onCopy={() => {
            toast({
              title: 'Copied To Clipboard',
              description: `SHA256 Checksum was copied to clipboard`,
            })
          }}
        />
      </div>
    </ShadowBox>
  )
}
