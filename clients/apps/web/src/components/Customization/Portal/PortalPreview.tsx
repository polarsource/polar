import { CustomerPortal } from '@/components/CustomerPortal/CustomerPortal'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { useContext } from 'react'
import { ORDER_PREVIEW, SUBSCRIPTION_ORDER_PREVIEW } from '../utils'

export const PortalPreview = () => {
  const { organization: org } = useContext(MaintainerOrganizationContext)

  return (
    <ShadowBox className="dark:bg-polar-950 flex h-full w-full flex-col items-center overflow-y-auto bg-white">
      <div className="pointer-events-none flex w-full max-w-7xl flex-col items-center gap-y-12">
        <Link
          href={`/${org.slug}/portal`}
          className="flex flex-col items-center gap-y-4"
        >
          <Avatar
            className="h-16 w-16 text-lg md:text-5xl"
            avatar_url={org.avatar_url}
            name={org.name}
          />
          <h3 className="text-xl md:text-2xl">{org.name}</h3>
        </Link>

        <CustomerPortal
          organization={org}
          subscriptions={[SUBSCRIPTION_ORDER_PREVIEW]}
          orders={[ORDER_PREVIEW]}
        />
      </div>
    </ShadowBox>
  )
}
