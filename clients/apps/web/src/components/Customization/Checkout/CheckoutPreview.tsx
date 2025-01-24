'use client'

import Checkout from '@/components/Checkout/Checkout'
import { DummyCheckoutContextProvider } from '@/components/Checkout/DummyCheckoutContextProvider'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import TopbarRight from '@/components/Layout/Public/TopbarRight'
import { StorefrontHeader } from '@/components/Profile/StorefrontHeader'
import { useAuth } from '@/hooks'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { Product } from '@polar-sh/api'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { useContext } from 'react'
import { CHECKOUT_PREVIEW } from '../utils'

export interface CheckoutPreviewProps {
  product?: Product
}

export const CheckoutPreview = ({}: CheckoutPreviewProps) => {
  const { organization: org } = useContext(MaintainerOrganizationContext)
  const { currentUser } = useAuth()

  return (
    <ShadowBox className="dark:bg-polar-950 flex h-full w-full flex-col items-center overflow-y-auto bg-white">
      <div className="pointer-events-none flex w-full max-w-7xl flex-col items-center gap-y-12">
        {org.profile_settings?.enabled && (
          <>
            <div className="relative flex w-full flex-row items-center justify-end gap-x-6">
              <BrandingMenu
                className="absolute left-1/2 -translate-x-1/2"
                size={50}
              />

              <TopbarRight authenticatedUser={currentUser} />
            </div>
            <StorefrontHeader organization={org} />
          </>
        )}
        <DummyCheckoutContextProvider checkout={CHECKOUT_PREVIEW}>
          <Checkout />
        </DummyCheckoutContextProvider>
      </div>
    </ShadowBox>
  )
}
