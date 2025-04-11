'use client'

import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import TopbarRight from '@/components/Layout/Public/TopbarRight'
import { useAuth } from '@/hooks'
import { useProducts } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { useFormContext } from 'react-hook-form'
import { Storefront } from '../../Profile/Storefront'
import { StorefrontHeader } from '../../Profile/StorefrontHeader'

export const StorefrontPreview = ({
  organization: org,
}: {
  organization: schemas['Organization']
}) => {
  const { watch } = useFormContext<schemas['OrganizationUpdate']>()
  const { currentUser } = useAuth()
  const organizationUpdate = watch()

  const organization = { ...org, ...organizationUpdate }

  const products =
    useProducts(organization.id, { is_archived: false }).data?.items ?? []

  return (
    <ShadowBox className="dark:bg-polar-950 flex h-full w-full flex-col items-center overflow-y-auto bg-white">
      <div className="flex w-full max-w-7xl flex-col gap-y-12">
        <div className="relative flex flex-row items-center justify-end gap-x-6">
          <BrandingMenu
            className="absolute left-1/2 -translate-x-1/2"
            size={50}
          />

          <TopbarRight authenticatedUser={currentUser} />
        </div>
        <div className="flex flex-grow flex-col items-center">
          <StorefrontHeader
            organization={organization as schemas['Organization']}
          />
        </div>
        <div className="flex h-full flex-grow flex-col gap-y-8 pb-16 md:gap-y-16">
          <Storefront
            organization={organization as schemas['Organization']}
            products={products}
          />
        </div>
      </div>
    </ShadowBox>
  )
}
