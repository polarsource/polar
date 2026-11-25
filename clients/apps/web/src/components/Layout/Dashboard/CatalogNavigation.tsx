'use client'

import { useCatalogs, useLiveCatalog } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Text, Tooltip, TooltipContent, TooltipTrigger } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
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
import { twMerge } from 'tailwind-merge'
import { PANEL_CLASS } from '../../Shared/Toolbar/ToolbarFilterMenu'
import { CatalogHoverCard, DraftGlyph, versionsHref } from './CatalogHoverCard'
import { NavList } from './NavList'

const CatalogVersionChip = ({
  organization,
  live,
  draft,
}: {
  organization: schemas['Organization']
  live: schemas['Catalog'] | null | undefined
  draft: schemas['Catalog'] | null | undefined
}) => (
  <Tooltip delayDuration={150}>
    <TooltipTrigger asChild>
      <Link
        href={versionsHref(
          organization,
          live ? undefined : (draft ?? undefined),
        )}
        className="flex min-w-0"
        aria-label={
          live && draft
            ? `${live.name ?? 'Untitled'}, unpublished draft`
            : undefined
        }
      >
        <Box
          as="span"
          display="flex"
          alignItems="center"
          columnGap="xs"
          minWidth={0}
          color={{ base: 'text-tertiary', hover: 'text-primary' }}
          transitionProperty="colors"
          transitionDuration="fast"
        >
          {!live && draft ? <DraftGlyph size={10} /> : null}
          <Text as="span" variant="caption" color="inherit" truncate>
            {live ? (live.name ?? 'Untitled') : 'Draft'}
          </Text>
          {live && draft ? <DraftGlyph size={10} /> : null}
        </Box>
      </Link>
    </TooltipTrigger>
    <TooltipContent
      side="right"
      align="start"
      sideOffset={8}
      className={twMerge(
        PANEL_CLASS,
        'origin-(--radix-tooltip-content-transform-origin) p-0',
      )}
    >
      <CatalogHoverCard organization={organization} live={live} draft={draft} />
    </TooltipContent>
  </Tooltip>
)

const CatalogLabel = ({
  organization,
  live,
  draft,
}: {
  organization: schemas['Organization']
  live: schemas['Catalog'] | null | undefined
  draft: schemas['Catalog'] | null | undefined
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
    {live || draft ? (
      <Box maxWidth="50%" minWidth={0}>
        <CatalogVersionChip
          organization={organization}
          live={live}
          draft={draft}
        />
      </Box>
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
  const { data: latest } = useCatalogs(organization.id, 1, 1)
  const draft = latest?.items.find(({ status }) => status === 'draft')
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
          <CatalogLabel
            organization={organization}
            live={liveCatalog}
            draft={draft}
          />
        ) : null}
        <NavList routes={catalogRoutes} navType="organization" />
      </Box>
    </Box>
  )
}
