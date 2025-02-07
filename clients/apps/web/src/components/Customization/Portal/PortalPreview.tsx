import { CustomerPortal } from '@/components/CustomerPortal/CustomerPortal'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { components } from '@polar-sh/client'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { useContext } from 'react'
import { ORDER_PREVIEW, SUBSCRIPTION_ORDER_PREVIEW } from '../utils'

export const PortalPreview = () => {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  return (
    <ShadowBox className="dark:bg-polar-950 flex h-full w-full flex-col items-center overflow-y-auto bg-white p-0">
      <CustomerPortal
        organization={org as components['schemas']['Organization']}
        subscriptions={
          [
            SUBSCRIPTION_ORDER_PREVIEW,
          ] as components['schemas']['CustomerSubscription'][]
        }
        orders={[ORDER_PREVIEW] as components['schemas']['CustomerOrder'][]}
      />
    </ShadowBox>
  )
}
