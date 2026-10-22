'use client'

import { useCatalogs } from '@/hooks/queries/catalogs'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import LayersOutlined from '@mui/icons-material/LayersOutlined'
import { schemas } from '@polar-sh/client'
import { Status, StatusColor, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
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
import { useMemo } from 'react'
import { CatalogVersion, catalogVersions } from './catalogVersions'

const STATUS: Record<
  schemas['Catalog']['status'],
  { label: string; color: StatusColor }
> = {
  live: { label: 'Live', color: 'green' },
  archived: { label: 'Archived', color: 'gray' },
}

const CatalogVersionRow = ({ version }: { version: CatalogVersion }) => {
  const status = STATUS[version.catalog.status]
  return (
    <Box alignItems="center" columnGap="s" width="100%">
      <Box flexDirection="column" minWidth={0}>
        <Text truncate>{version.label}</Text>
        <Text variant="caption" color="muted" truncate>
          <Text as="span" variant="caption" color="muted" monospace>
            {version.shortHash}
          </Text>
          {' · '}
          <PolarTimeAgo date={new Date(version.catalog.published_at)} />
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
  const { data, isLoading } = useCatalogs(organization.id, enabled)
  const versions = useMemo(() => catalogVersions(data ?? []), [data])

  if (!enabled) {
    return null
  }

  const current =
    versions.find(({ catalog }) => catalog.status === 'live') ?? versions[0]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip="Catalog version">
              <LayersOutlined fontSize="inherit" />
              <Text as="span" truncate>
                {current
                  ? `Catalog ${current.label}`
                  : isLoading
                    ? 'Loading…'
                    : 'No catalog published'}
              </Text>
              <Box as="span" marginLeft="auto">
                <KeyboardArrowDown fontSize="inherit" />
              </Box>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {versions.length > 0 ? (
            <DropdownMenuContent
              side="bottom"
              align="start"
              className="w-(--radix-popper-anchor-width) min-w-[220px]"
            >
              {versions.map((version) => (
                <DropdownMenuItem key={version.catalog.id}>
                  <CatalogVersionRow version={version} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          ) : null}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
