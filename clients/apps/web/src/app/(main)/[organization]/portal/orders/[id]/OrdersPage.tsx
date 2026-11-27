'use client'

import CustomerPortalOrder from '@/components/CustomerPortal/CustomerPortalOrder'
import { PortalBackLink } from '@/components/CustomerPortal/PortalPrimitives'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { useParams } from 'next/navigation'
import { getThemePreset } from '@polar-sh/ui/hooks/theming'
import { useTheme } from 'next-themes'

const ClientPage = ({
  order,
  customerSessionToken,
}: {
  order: schemas['CustomerOrder']
  customerSessionToken: string
}) => {
  const theme = useTheme()
  const themingPreset = getThemePreset(theme.resolvedTheme as 'light' | 'dark')
  const params = useParams<{ organization: string }>()
  const api = createClientSideAPI(customerSessionToken)

  return (
    <>
      <PortalBackLink
        href={`/${params.organization}/portal/orders?customer_session_token=${customerSessionToken}`}
      >
        Orders
      </PortalBackLink>
      <CustomerPortalOrder
        api={api}
        order={order}
        customerSessionToken={customerSessionToken}
        themingPreset={themingPreset}
      />
    </>
  )
}

export default ClientPage
