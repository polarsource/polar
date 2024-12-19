import { CustomerPortal } from '@/components/CustomerPortal/CustomerPortal'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useContext } from 'react'
import { ORDER_PREVIEW, SUBSCRIPTION_ORDER_PREVIEW } from '../utils'

export const PortalPreview = () => {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  return (
    <ShadowBox className="dark:bg-polar-950 flex h-full w-full flex-col items-center overflow-y-auto bg-white p-0">
      <CustomerPortal
        organization={org}
        subscriptions={[SUBSCRIPTION_ORDER_PREVIEW]}
        orders={[ORDER_PREVIEW]}
      />
    </ShadowBox>
  )
}
