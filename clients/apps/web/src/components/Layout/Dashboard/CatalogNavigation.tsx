'use client'

import { useLiveCatalog } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { LockOutlined } from '@polar-sh/orbit/icons'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
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
import { NavList } from './NavList'

const LiveCatalogDetails = ({ catalog }: { catalog: schemas['Catalog'] }) => (
  <Box flexDirection="column" minWidth={0}>
    <Box flexDirection="column" rowGap="xs" padding="m" minWidth={0}>
      <Text variant="label" truncate>
        {catalog.name ?? 'Untitled'}
      </Text>
      <Text variant="caption" color="muted">
        <Text as="span" variant="caption" color="inherit" monospace>
          {catalog.version_hash?.slice(0, 7)}
        </Text>
        {' · '}
        <FormattedDateTime
          datetime={catalog.published_at ?? catalog.created_at}
          resolution="time"
        />
      </Text>
    </Box>
    <Box
      alignItems="center"
      columnGap="xs"
      paddingHorizontal="m"
      paddingVertical="s"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
      color="text-secondary"
    >
      <LockOutlined fontSize="inherit" />
      <Text as="span" variant="caption" color="inherit">
        Managed in code
      </Text>
    </Box>
  </Box>
)

const CatalogLabel = ({
  catalog,
}: {
  catalog: schemas['Catalog'] | null | undefined
}) => {
  const label = (
    <Box
      alignItems="center"
      justifyContent="between"
      columnGap="s"
      paddingHorizontal="s"
      color="text-tertiary"
      cursor="default"
      userSelect="none"
      minWidth={0}
      tabIndex={catalog ? 0 : undefined}
    >
      <Text as="span" variant="label" color="inherit">
        Catalog
      </Text>
      {catalog ? (
        <Text as="span" variant="caption" color="inherit" truncate>
          <PolarTimeAgo
            date={new Date(catalog.published_at ?? catalog.created_at)}
          />
        </Text>
      ) : null}
    </Box>
  )

  if (!catalog) return label

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent side="right" align="start" sideOffset={8} className="p-0">
        <LiveCatalogDetails catalog={catalog} />
      </TooltipContent>
    </Tooltip>
  )
}

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
        {state === 'expanded' ? <CatalogLabel catalog={liveCatalog} /> : null}
        <NavList routes={catalogRoutes} navType="organization" />
      </Box>
    </Box>
  )
}
