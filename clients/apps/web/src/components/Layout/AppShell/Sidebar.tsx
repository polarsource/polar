'use client'

import {
  useAccountRoutes,
  useGeneralRoutes,
  useOrganizationRoutes,
  type RouteWithActive,
  type SubRouteWithActive,
} from '@/components/Dashboard/navigation'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { schemas } from '@polar-sh/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const LINK_RESET = { textDecoration: 'none', color: 'inherit' } as const

type SidebarProps = {
  type: 'organization' | 'account'
  organization?: schemas['Organization']
}

export const Sidebar = ({ type, organization }: SidebarProps) => {
  if (type === 'account') {
    return <AccountSidebar />
  }
  return <OrganizationSidebar organization={organization} />
}

const OrganizationSidebar = ({
  organization,
}: {
  organization?: schemas['Organization']
}) => {
  const generalRoutes = useGeneralRoutes(organization)
  const orgRoutes = useOrganizationRoutes(organization)
  const allRoutes = [...generalRoutes, ...orgRoutes]
  const activeRoute = allRoutes.find((r) => r.isActive)
  const subSection =
    activeRoute && activeRoute.subs && activeRoute.subs.length > 0
      ? activeRoute
      : undefined

  const rootHref = organization
    ? `/dashboard/${organization.slug}`
    : '/dashboard'

  return (
    <SidebarFrame rootHref={rootHref}>
      {subSection ? (
        <SubSectionView section={subSection} parentHref={rootHref} />
      ) : (
        <TopLevelView routes={allRoutes} />
      )}
    </SidebarFrame>
  )
}

const AccountSidebar = () => {
  const routes = useAccountRoutes()
  return (
    <SidebarFrame rootHref="/dashboard/account/preferences">
      <TopLevelView routes={routes} />
    </SidebarFrame>
  )
}

const SidebarFrame = ({
  rootHref,
  children,
}: {
  rootHref: string
  children: React.ReactNode
}) => (
  <Box
    as="aside"
    width={232}
    flexShrink={0}
    display="flex"
    flexDirection="column"
    rowGap="3xl"
    paddingHorizontal="xl"
    paddingVertical="xl"
    position="sticky"
    minHeight={0}
    top={0}
  >
    <Box marginLeft="2xl">
      <Link href={rootHref} style={LINK_RESET}>
        <Text variant="heading-xs" color="default">
          Polar
        </Text>
      </Link>
    </Box>

    <Box as="nav" display="flex" flexDirection="column" rowGap="s">
      {children}
    </Box>
  </Box>
)

const TopLevelView = ({ routes }: { routes: RouteWithActive[] }) => (
  <>
    {routes.map((route) => (
      <NavRow
        key={route.id}
        href={route.link}
        label={route.title}
        isActive={route.isActive}
      />
    ))}
  </>
)

const SubSectionView = ({
  section,
  parentHref,
}: {
  section: RouteWithActive
  parentHref: string
}) => (
  <Box display="flex" flexDirection="column" rowGap="xl">
    <Link href={parentHref} style={LINK_RESET}>
      <Box display="flex" alignItems="center" columnGap="l">
        <Box display="inline-flex" alignItems="center" justifyContent="center">
          <ArrowLeft size={14} strokeWidth={2} />
        </Box>
        <Text variant="heading-xs">{section.title}</Text>
      </Box>
    </Link>

    <Box display="flex" flexDirection="column" rowGap="s">
      {((section.subs ?? []) as SubRouteWithActive[]).map((sub) => (
        <SubNavRow key={sub.link} sub={sub} />
      ))}
    </Box>
  </Box>
)

const NavRow = ({
  href,
  label,
  isActive,
}: {
  href: string
  label: string
  isActive: boolean
}) => (
  <Link href={href} style={LINK_RESET}>
    <Box display="flex" alignItems="center" columnGap="xl">
      <Box
        width={6}
        height={6}
        borderRadius="full"
        backgroundColor={isActive ? 'background-inverse' : 'background-card'}
        opacity={isActive ? 1 : 0}
      />
      <Text variant="heading-xs" color={isActive ? 'default' : 'muted'}>
        {label}
      </Text>
    </Box>
  </Link>
)

const SubNavRow = ({ sub }: { sub: SubRouteWithActive }) => (
  <Link href={sub.link} style={LINK_RESET}>
    <Box display="flex" alignItems="center" columnGap="xl">
      <Box
        width={6}
        height={6}
        borderRadius="full"
        backgroundColor={
          sub.isActive ? 'background-inverse' : 'background-card'
        }
        opacity={sub.isActive ? 1 : 0}
      />
      <Text variant="heading-xs" color={sub.isActive ? 'default' : 'muted'}>
        {sub.title}
      </Text>
    </Box>
  </Link>
)
