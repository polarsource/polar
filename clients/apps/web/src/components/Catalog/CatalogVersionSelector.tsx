'use client'

import { useCatalogs } from '@/hooks/queries/catalogs'
import { schemas } from '@polar-sh/client'
import { Status, StatusColor, Text } from '@polar-sh/orbit'
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

const STATUS: Record<
  schemas['Catalog']['status'],
  { label: string; color: StatusColor }
> = {
  live: { label: 'Live', color: 'green' },
  archived: { label: 'Archived', color: 'gray' },
}

const shortHash = (catalog: schemas['Catalog']) =>
  catalog.version_hash.slice(0, 7)

const CatalogVersionRow = ({ catalog }: { catalog: schemas['Catalog'] }) => {
  const status = STATUS[catalog.status]
  return (
    <Box alignItems="center" columnGap="s" width="100%">
      <Box flexDirection="column" minWidth={0}>
        <Text monospace truncate>
          {shortHash(catalog)}
        </Text>
        <Text variant="caption" color="muted" truncate>
          <PolarTimeAgo date={new Date(catalog.published_at)} />
        </Text>
      </Box>
      <Box marginLeft="auto">
        <Status status={status.label} color={status.color} size="small" />
      </Box>
    </Box>
  )
}

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
