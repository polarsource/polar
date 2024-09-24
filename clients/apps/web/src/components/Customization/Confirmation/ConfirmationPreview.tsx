import { Confirmation } from '@/components/Checkout/Confirmation'
import { BrandingMenu } from '@/components/Layout/Public/BrandingMenu'
import TopbarRight from '@/components/Layout/Public/TopbarRight'
import { StorefrontNav } from '@/components/Organization/StorefrontNav'
import { StorefrontHeader } from '@/components/Profile/StorefrontHeader'
import { useAuth } from '@/hooks'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useContext } from 'react'
import { CHECKOUT_PREVIEW } from '../utils'

export const ConfirmationPreview = () => {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  const { currentUser } = useAuth()

  return (
    <ShadowBox className="dark:bg-polar-950 flex h-full w-full flex-col items-center overflow-y-auto">
      <div className="flex w-full max-w-7xl flex-col gap-y-12">
        <div className="relative flex flex-row items-center justify-end gap-x-6">
          <BrandingMenu
            className="absolute left-1/2 -translate-x-1/2"
            size={50}
          />

          <TopbarRight authenticatedUser={currentUser} />
        </div>
        {org.profile_settings?.enabled && (
          <>
            <StorefrontHeader organization={org} />
            <StorefrontNav organization={org} />
          </>
        )}
        <Confirmation organization={org} checkout={CHECKOUT_PREVIEW} disabled />
      </div>
    </ShadowBox>
  )
}
