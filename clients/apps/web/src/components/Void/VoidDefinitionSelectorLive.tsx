'use client'

import GraphicEqOutlined from '@mui/icons-material/GraphicEqOutlined'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import { schemas } from '@polar-sh/client'
import { Status } from '@polar-sh/orbit'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@polar-sh/ui/components/atoms/Sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/ui/dropdown-menu'
import { useMemo, useState } from 'react'
import {
  shortVersion,
  useVoidBranches,
  useVoidDeploys,
  versionLabels,
  VoidBranch,
  VoidDeploy,
} from './api'
import { DataSourceMenuItem } from './DataSourceMenuItem'

interface VoidDefinition {
  id: string
  name: string
  version: string
  status: 'Active' | 'Draft' | 'Archived' | 'Branch'
}

const STATUS_COLOR: Record<
  VoidDefinition['status'],
  'green' | 'blue' | 'gray'
> = { Active: 'green', Draft: 'blue', Archived: 'gray', Branch: 'blue' }

const STATUS_ORDER: Record<NonNullable<VoidDeploy['status']>, number> = {
  active: 0,
  draft: 1,
  archived: 2,
}

const relative = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 60) return `${Math.max(minutes, 0)}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const statusLabel = (status: VoidDeploy['status']): VoidDefinition['status'] =>
  status === 'active' ? 'Active' : status === 'archived' ? 'Archived' : 'Draft'

/**
 * Deployed versions in lineage order, each followed by the branches that
 * fork it. Versions carry their short hash; branches carry their name.
 */
export const definitionsOf = (
  deploys: VoidDeploy[],
  branches: VoidBranch[],
): VoidDefinition[] => {
  const labels = versionLabels(deploys)
  const ordered = [...deploys].sort(
    (a, b) =>
      STATUS_ORDER[a.status ?? 'draft'] - STATUS_ORDER[b.status ?? 'draft'] ||
      b.created_at.localeCompare(a.created_at),
  )
  return ordered.flatMap((deploy) => [
    {
      id: deploy.id ?? deploy.version_id,
      name: labels.get(deploy.version_id) ?? shortVersion(deploy.version_id),
      version: `${shortVersion(deploy.version_id)} · ${relative(deploy.created_at)}`,
      status: statusLabel(deploy.status),
    },
    ...branches
      .filter((branch) => branch.base_version_id === deploy.version_id)
      .map((branch) => ({
        id: branch.id,
        name: branch.name,
        version: `branch of ${labels.get(branch.base_version_id) ?? shortVersion(branch.base_version_id)}`,
        status: 'Branch' as const,
      })),
  ])
}

export const VoidDefinitionSelectorLive = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const deploys = useVoidDeploys(organization.id)
  const branches = useVoidBranches(organization.id)
  const definitions = useMemo(
    () => definitionsOf(deploys.data ?? [], branches.data ?? []),
    [deploys.data, branches.data],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    definitions.find((definition) => definition.id === selectedId) ??
    definitions[0]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              tooltip="Definition"
              className="dark:bg-polar-900 dark:border-polar-800 gap-x-4 border border-gray-200 bg-white shadow-xs"
            >
              <span className="dark:text-polar-500 flex shrink-0 items-center text-[15px] text-gray-500">
                <GraphicEqOutlined fontSize="inherit" />
              </span>
              <span className="flex items-center gap-2 truncate text-sm">
                {selected ? (
                  <>
                    <span className="truncate">{selected.name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{selected.version}</span>
                  </>
                ) : (
                  <span className="truncate">
                    {deploys.isLoading ? 'Loading…' : 'No versions deployed'}
                  </span>
                )}
              </span>

              <KeyboardArrowDown className="ml-auto" fontSize="inherit" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
            className="w-(--radix-popper-anchor-width) min-w-[220px]"
          >
            {definitions.map((definition) => (
              <DropdownMenuItem
                key={definition.id}
                className="dark:hover:bg-polar-800! flex flex-row items-center gap-x-2 duration-75 hover:bg-gray-100! hover:text-black! dark:hover:text-white!"
                onClick={() => setSelectedId(definition.id)}
              >
                <span
                  className={
                    definition.status === 'Branch'
                      ? 'flex min-w-0 flex-col pl-3'
                      : 'flex min-w-0 flex-col'
                  }
                >
                  <span className="truncate">{definition.name}</span>
                  <span className="dark:text-polar-500 text-xs text-gray-500">
                    {definition.version}
                  </span>
                </span>
                <span className="ml-auto">
                  <Status
                    status={definition.status}
                    color={STATUS_COLOR[definition.status]}
                    size="small"
                  />
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DataSourceMenuItem />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
