'use client'

import { useCustomerPortalSession } from '@/hooks/queries/customerPortal'
import { createClientSideAPI } from '@/utils/client'
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined'
import { schemas } from '@polar-sh/client'
import { Avatar, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { PortalText } from '@/components/CustomerPortal/PortalPrimitives'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'

const usePortalToken = () => {
  const searchParams = useSearchParams()
  return (
    searchParams.get('customer_session_token') ??
    searchParams.get('member_session_token') ??
    ''
  )
}

const SidebarHeader = ({
  organization,
}: {
  organization: schemas['CustomerOrganization']
}) => {
  const token = usePortalToken()
  const { data: session } = useCustomerPortalSession(createClientSideAPI(token))

  return (
    <Box alignItems="center" columnGap="m" minWidth={0}>
      <Avatar
        className="h-8 w-8 flex-none text-xs"
        avatar_url={organization.avatar_url}
        name={organization.name}
      />
      {session?.return_url ? (
        <Link
          href={session.return_url}
          className="flex min-w-0 items-center gap-x-1.5 text-sm"
        >
          <Box
            as="span"
            display="inline-flex"
            alignItems="center"
            columnGap="xs"
            minWidth={0}
            color={{ base: 'text-secondary', hover: 'text-primary' }}
            transitionProperty="colors"
            transitionDuration="fast"
          >
            <ArrowBackOutlined fontSize="inherit" className="flex-none" />
            <span className="truncate">Back to {organization.name}</span>
          </Box>
        </Link>
      ) : (
        <Box display={{ base: 'flex', md: 'none' }} minWidth={0}>
          <PortalText block className="truncate text-sm">
            {organization.name}
          </PortalText>
        </Box>
      )}
    </Box>
  )
}

const PoweredByPolar = () => (
  <PortalText tone="tertiary" className="text-xs">
    Powered by{' '}
    <a
      href="https://polar.sh"
      target="_blank"
      rel="noopener noreferrer"
      className="underline-offset-2 hover:underline"
    >
      Polar
    </a>
  </PortalText>
)

export const PortalShell = ({
  organization,
  sidebar,
  children,
  centered = false,
}: {
  organization: schemas['CustomerOrganization']
  sidebar?: ReactNode
  children: ReactNode
  centered?: boolean
}) => (
  <Box
    minHeight="100vh"
    width="100%"
    flexDirection={{ base: 'column', md: 'row' }}
    backgroundColor="background-primary"
  >
    <Box
      as="aside"
      flexDirection="column"
      flexShrink={0}
      width={{ base: '100%', md: '36%' }}
      minWidth={{ md: 280 }}
      maxWidth={{ md: 480 }}
      height={{ md: '100vh' }}
      position={{ md: 'sticky' }}
      top={0}
      overflowY={{ md: 'auto' }}
      rowGap={{ base: 'xl', md: '3xl' }}
      paddingHorizontal={{ base: 'l', md: '2xl', lg: '3xl' }}
      paddingTop={{ base: 'l', md: '2xl', lg: '3xl' }}
      paddingBottom={{ base: 'none', md: '2xl', lg: '3xl' }}
      backgroundColor="background-secondary"
      borderBottomWidth={{ base: 1, md: 0 }}
      borderRightWidth={{ base: 0, md: 1 }}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      <SidebarHeader organization={organization} />
      <Box flexDirection="column" display={{ base: 'none', md: 'flex' }}>
        <Text variant="heading-xs" as="p">
          {organization.name}
        </Text>
        <Text variant="heading-xs" as="p" color="muted">
          Customer portal
        </Text>
      </Box>
      <Box flexDirection="column" flex={1} rowGap="3xl" minHeight={0}>
        {sidebar}
      </Box>
      <Box display={{ base: 'none', md: 'flex' }}>
        <PoweredByPolar />
      </Box>
    </Box>
    <Box
      as="main"
      flex={1}
      minWidth={0}
      justifyContent="center"
      alignItems={centered ? { md: 'center' } : 'start'}
      paddingHorizontal={{ base: 'l', md: '2xl', lg: '4xl' }}
      paddingVertical={{ base: '2xl', md: '4xl' }}
    >
      <Box
        width="100%"
        maxWidth={centered ? 400 : 720}
        flexDirection="column"
        rowGap={{ base: '3xl', md: '4xl' }}
      >
        {children}
        <Box display={{ base: 'flex', md: 'none' }} justifyContent="center">
          <PoweredByPolar />
        </Box>
      </Box>
    </Box>
  </Box>
)

export const PortalAuthShell = ({
  organization,
  children,
}: {
  organization: schemas['CustomerOrganization']
  children: ReactNode
}) => (
  <PortalShell
    organization={organization}
    centered
    sidebar={
      <Box
        as="span"
        display={{ base: 'none', md: 'block' }}
        color="text-secondary"
        maxWidth={320}
      >
        Manage your subscriptions, review past orders, download invoices and
        keep your billing details up to date.
      </Box>
    }
  >
    {children}
  </PortalShell>
)

export const PortalAuthHeader = ({
  title,
  description,
}: {
  title: ReactNode
  description?: ReactNode
}) => (
  <Box flexDirection="column" rowGap="s">
    <Text variant="heading-xs" as="h1">
      {title}
    </Text>
    {description ? (
      <PortalText tone="secondary" className="text-sm">
        {description}
      </PortalText>
    ) : null}
  </Box>
)
