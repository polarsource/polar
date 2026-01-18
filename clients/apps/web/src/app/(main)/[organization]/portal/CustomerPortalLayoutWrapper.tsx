'use client'

import { schemas } from '@polar-sh/client'
import { CustomerPortalProvider } from '@polar-sh/customer-portal/react'
import { useRouter, useSearchParams } from 'next/navigation'

interface CustomerPortalLayoutWrapperProps {
  organization: schemas['CustomerOrganization']
  children: React.ReactNode
}

export function CustomerPortalLayoutWrapper({
  organization,
  children,
}: CustomerPortalLayoutWrapperProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
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
      onUnauthorized={() => {
        router.push(`/${organization.slug}/portal/request`)
      }}
    >
      {children}
    </CustomerPortalProvider>
  )
}
