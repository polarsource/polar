'use client'

import { useLiveCatalog } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { LockOutlined } from '@polar-sh/orbit/icons'
import PolarTimeAgo from '@polar-sh/ui/components/atoms/PolarTimeAgo'
import { useSidebar } from '@polar-sh/ui/components/atoms/Sidebar'
import {
  useGeneralRoutes,
  useOrganizationRoutes,
} from '../../Dashboard/navigation'
import {
  useCatalogRoutes,
  useDiscountRoutes,
} from '../../Dashboard/navigationProducts'
import Link from 'next/link'
import { NavList } from './NavList'

const LiveCatalogDetails = ({ catalog }: { catalog: schemas['Catalog'] }) => (
  <Box
    flexDirection="column"
    rowGap="xs"
    padding="m"
    maxWidth={240}
    minWidth={0}
  >
    <Text variant="label" truncate>
      {catalog.name ?? 'Untitled'}
    </Text>
    <Text variant="caption" color="muted">
      Published{' '}
      <PolarTimeAgo
        date={new Date(catalog.published_at ?? catalog.created_at)}
      />
    </Text>
    <Box alignItems="center" columnGap="xs" color="text-tertiary">
      <LockOutlined fontSize="inherit" />
      <Text as="span" variant="caption" color="inherit">
        Managed in code
      </Text>
    </Box>
  </Box>
)

const CatalogVersionChip = ({
  organization,
  catalog,
}: {
  organization: schemas['Organization']
  catalog: schemas['Catalog']
}) => (
  <Tooltip delayDuration={150}>
    <TooltipTrigger asChild>
      <Link
        href={`/dashboard/${organization.slug}/products/versions`}
        className="flex min-w-0"
      >
        <Box
          as="span"
          display="flex"
          minWidth={0}
          color={{ base: 'text-tertiary', hover: 'text-primary' }}
          transitionProperty="colors"
          transitionDuration="fast"
        >
          <Text as="span" variant="caption" color="inherit" truncate>
            {catalog.name ?? 'Untitled'}
          </Text>
        </Box>
      </Link>
    </TooltipTrigger>
    <TooltipContent side="right" align="start" sideOffset={8} className="p-0">
      <LiveCatalogDetails catalog={catalog} />
    </TooltipContent>
  </Tooltip>
)

const CatalogLabel = ({
  organization,
  catalog,
}: {
  organization: schemas['Organization']
  catalog: schemas['Catalog'] | null | undefined
}) => (
  <Box
    alignItems="center"
    justifyContent="between"
    columnGap="s"
    paddingHorizontal="s"
    color="text-tertiary"
    userSelect="none"
    minWidth={0}
  >
    <Text as="span" variant="label" color="inherit">
      Catalog
    </Text>
    {catalog ? (
      <CatalogVersionChip organization={organization} catalog={catalog} />
    ) : null}
  </Box>
)

export const CatalogNavigation = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const { state } = useSidebar()
  const { data: liveCatalog } = useLiveCatalog(organization.id, true)
  const generalRoutes = useGeneralRoutes(organization)
  const organizationRoutes = useOrganizationRoutes(organization)
  const discountRoutes = useDiscountRoutes(organization)
  const catalogRoutes = useCatalogRoutes(organization)

  const topRoutes = generalRoutes
    .filter((route) => route.id !== 'new-products')
    .flatMap((route) =>
      route.id === 'customers' ? [route, ...discountRoutes] : [route],
    )

  return (
    <Box width="100%" flexDirection="column" rowGap="xl">
      <NavList
        routes={[...topRoutes, ...organizationRoutes]}
        navType="organization"
      />
      <Box width="100%" flexDirection="column" rowGap="s">
        {state === 'expanded' ? (
          <CatalogLabel organization={organization} catalog={liveCatalog} />
        ) : null}
        <NavList routes={catalogRoutes} navType="organization" />
      </Box>
    </Box>
  )
}
