'use client'

import { toast } from '@/components/Toast/use-toast'
import { useSafeCopy } from '@/hooks/clipboard'
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
import { useEffect, useRef, useState } from 'react'
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

const CatalogVersionChip = ({ catalog }: { catalog: schemas['Catalog'] }) => {
  const [copied, setCopied] = useState(false)
  const safeCopy = useSafeCopy(toast)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), 1200)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger
        ref={triggerRef}
        aria-label="Copy live catalog version hash"
        className="flex"
        // Radix closes the tooltip on press; keep it open so the copy is visible
        onPointerDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.preventDefault()
          if (!catalog.version_hash) return
          void safeCopy(catalog.version_hash).then(() => setCopied(true))
        }}
      >
        <Box
          as="span"
          display="flex"
          color={{ base: 'text-tertiary', hover: 'text-primary' }}
          transitionProperty="colors"
          transitionDuration="fast"
          cursor="default"
        >
          <Text as="span" variant="caption" color="inherit" monospace>
            {copied ? 'Copied' : catalog.version_hash?.slice(0, 7)}
          </Text>
        </Box>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="start"
        sideOffset={8}
        className="p-0"
        onPointerDownOutside={(event) => {
          if (triggerRef.current?.contains(event.target as Node)) {
            event.preventDefault()
          }
        }}
      >
        <LiveCatalogDetails catalog={catalog} />
      </TooltipContent>
    </Tooltip>
  )
}

const CatalogLabel = ({
  catalog,
}: {
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
    {catalog ? <CatalogVersionChip catalog={catalog} /> : null}
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
        {state === 'expanded' ? <CatalogLabel catalog={liveCatalog} /> : null}
        <NavList routes={catalogRoutes} navType="organization" />
      </Box>
    </Box>
  )
}
