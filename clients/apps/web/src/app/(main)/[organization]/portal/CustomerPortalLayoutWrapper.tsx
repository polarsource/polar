'use client'

import { CustomerPortalProvider } from '@/components/CustomerPortal/CustomerPortalProvider'
import { useCustomerPortalSession } from '@/hooks/queries/customerPortal'
import { createClientSideAPI } from '@/utils/client'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { schemas } from '@polar-sh/client'
import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { TooltipProvider } from '@polar-sh/orbit'
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
      <TooltipProvider>
        <Box
          flexDirection="row"
          alignItems="center"
          columnGap="m"
          paddingHorizontal={{ base: 'l', lg: '2xl' }}
          paddingVertical={{ base: 'l', lg: '2xl' }}
        >
          <Avatar
            className="h-8 w-8 flex-none"
            avatar_url={organization.avatar_url}
            name={organization.name}
          />
          {session?.return_url && (
            <Link href={session.return_url}>
              <Box
                alignItems="center"
                columnGap="xs"
                minWidth={0}
                color="text-secondary"
              >
                <ArrowBackOutlined fontSize="inherit" className="flex-none" />
                <Text variant="caption" color="muted" truncate>
                  Back to {organization.name}
                </Text>
              </Box>
            </Link>
          )}
        </Box>
        <Box
          width="100%"
          flexDirection="column"
          paddingHorizontal={{ base: 'l', lg: 'none' }}
          paddingVertical="2xl"
          marginHorizontal={{ md: 'auto' }}
          maxWidth={{ md: 1024 }}
        >
          {children}
        </Box>
      </TooltipProvider>
    </CustomerPortalProvider>
  )
}
