'use client'

import { CustomerPortalProvider } from '@/components/CustomerPortal/CustomerPortalProvider'
import { useCustomerPortalSession } from '@/hooks/queries/customerPortal'
import { createClientSideAPI } from '@/utils/client'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { schemas } from '@polar-sh/client'
import Avatar from '@polar-sh/ui/components/atoms/Avatar'
import Link from 'next/link'
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

  const { data: session } = useCustomerPortalSession(createClientSideAPI(token))

  return (
    <CustomerPortalProvider
      token={token}
      organizationId={organization.id}
      organizationSlug={organization.slug}
      baseUrl={process.env.NEXT_PUBLIC_API_URL}
    >
      <div className="flex flex-row items-center gap-x-3 px-4 py-4 lg:px-8 lg:py-8">
        <Avatar
          className="h-8 w-8 flex-none"
          avatar_url={organization.avatar_url}
          name={organization.name}
        />
        {session?.return_url && (
          <Link
            href={session.return_url}
            className="dark:text-polar-500 flex min-w-0 flex-row items-center gap-x-1 text-xs text-gray-500"
          >
            <ArrowBackOutlined fontSize="inherit" className="flex-none" />
            <span className="truncate">Back to {organization.name}</span>
          </Link>
        )}
      </div>
      {children}
    </CustomerPortalProvider>
  )
}
