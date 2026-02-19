'use client'

import { CustomerPortalProvider } from '@/components/CustomerPortal/CustomerPortalProvider'
import { schemas } from '@polar-sh/client'
import { useSearchParams } from 'next/navigation'

interface CustomerPortalLayoutWrapperProps {
  organization: schemas['CustomerOrganization']
  children: React.ReactNode
}

export function CustomerPortalLayoutWrapper({
  organization,
  children,
}: CustomerPortalLayoutWrapperProps) {
  const searchParams = useSearchParams()
  const token =
    searchParams.get('customer_session_token') ??
    searchParams.get('member_session_token') ??
    ''

  return (
    <CustomerPortalProvider
      token={token}
      organizationId={organization.id}
      organizationSlug={organization.slug}
      baseUrl={process.env.NEXT_PUBLIC_API_URL}
    >
      {children}
    </CustomerPortalProvider>
  )
}
