import { CheckoutConfirmation } from '@/components/Checkout/CheckoutConfirmation'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import TopbarRight from '@/components/Layout/Public/TopbarRight'
import { StorefrontHeader } from '@/components/Profile/StorefrontHeader'
import { useAuth } from '@/hooks'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { CheckoutStatus, Product } from '@polar-sh/sdk'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useContext } from 'react'
import { CHECKOUT_PREVIEW, createCheckoutPreview } from '../utils'

export interface ConfirmationPreviewProps {
  product?: Product
}

export const ConfirmationPreview = ({ product }: ConfirmationPreviewProps) => {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  const { currentUser } = useAuth()

  return (
    <ShadowBox className="dark:bg-polar-950 flex h-full w-full flex-col items-center overflow-y-auto bg-gray-50">
      <div className="flex w-full max-w-7xl flex-col items-center gap-y-12">
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
        <CheckoutConfirmation
          organization={org}
          checkout={{
            ...(product
              ? createCheckoutPreview(product, product.prices[0])
              : CHECKOUT_PREVIEW),
            status: CheckoutStatus.SUCCEEDED,
          }}
          disabled
        />
      </div>
    </ShadowBox>
  )
}
