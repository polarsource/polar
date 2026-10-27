'use client'

import { useCatalogs } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  SignalCellularAltOutlined,
  KeyboardArrowDown,
} from '@polar-sh/orbit/icons'
import PolarTimeAgo from '@polar-sh/ui/components/atoms/PolarTimeAgo'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@polar-sh/ui/components/atoms/Sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'

const STATUS_LABEL: Record<schemas['Catalog']['status'], string> = {
  draft: 'Draft',
  live: 'Live',
  archived: 'Archived',
}

const CatalogVersionRow = ({ catalog }: { catalog: schemas['Catalog'] }) => (
  <Box flexDirection="column" rowGap="xs" minWidth={0} width="100%">
    <Text color={catalog.name ? 'default' : 'muted'} truncate>
      {catalog.name ?? 'Untitled'}
    </Text>
    <Box alignItems="center" columnGap="s">
      <Text variant="caption" color="muted" truncate>
        <Text as="span" variant="caption" color="muted" monospace>
          {catalog.version_hash?.slice(0, 7)}
        </Text>
        {' · '}
        <PolarTimeAgo
          date={new Date(catalog.published_at ?? catalog.created_at)}
        />
      </Text>
      <Box
        as="span"
        flexShrink={0}
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        borderRadius="s"
        paddingHorizontal="xs"
      >
        <Text
          as="span"
          variant="caption"
          color={catalog.status === 'live' ? 'default' : 'muted'}
        >
          {STATUS_LABEL[catalog.status]}
        </Text>
      </Box>
    </Box>
  </Box>
)

export const CatalogVersionSelector = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const enabled = !!organization.feature_settings?.config_as_code_enabled
  const { data: catalogs = [], isLoading } = useCatalogs(
    organization.id,
    enabled,
  )

  if (!enabled) {
    return null
  }

  const hasLive = catalogs.some((catalog) => catalog.status === 'live')

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <Box
            borderRadius="s"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            backgroundColor="background-primary"
            boxShadow="s"
          >
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton tooltip="Catalog version">
                <Box as="span" color="text-secondary">
                  <SignalCellularAltOutlined fontSize="inherit" />
                </Box>
                <Text as="span" truncate>
                  {hasLive
                    ? 'Live'
                    : isLoading
                      ? 'Loading…'
                      : 'No catalog published'}
                </Text>
                <Box as="span" marginLeft="auto">
                  <KeyboardArrowDown fontSize="inherit" />
                </Box>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
          </Box>
          {catalogs.length > 0 ? (
            <DropdownMenuContent
              side="bottom"
              align="start"
              className="w-(--radix-popper-anchor-width) min-w-[220px]"
            >
              {catalogs.map((catalog) => (
                <DropdownMenuItem key={catalog.id}>
                  <CatalogVersionRow catalog={catalog} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          ) : null}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
