import { type Filter } from '@/components/Shared/FilterPopover'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { type ReactNode } from 'react'
import { ToolbarActionsMenu, type ToolbarAction } from './ToolbarActionsMenu'
import { ToolbarFilterChips } from './ToolbarFilterChips'
import { ToolbarFilterMenu } from './ToolbarFilterMenu'

interface ToolbarProps {
  title: string
  // Everything set from the filter menu. Each one away from its default also
  // shows as a chip beside the title, ahead of the menu.
  filters: Filter[]
  // Offered while there is something to reset.
  onReset?: () => void
  // Shown in the more menu, one list per group.
  actions: ToolbarAction[][]
  // Controls that sit ahead of the filter menu.
  children?: ReactNode
}

// The bar at the top of a list page: its title, the applied filters, and the
// menus that change what is listed.
export const Toolbar = ({
  title,
  filters,
  onReset,
  actions,
  children,
}: ToolbarProps) => (
  <Box
    alignItems="center"
    justifyContent="between"
    gap="l"
    px="l"
    py="m"
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Box alignItems="center" columnGap="l" minWidth={0}>
      <Text as="h1" variant="body" wrap="nowrap">
        {title}
      </Text>
      {filters.length > 0 && (
        <ToolbarFilterChips
          filters={filters}
          trailing={<ToolbarFilterMenu filters={filters} onReset={onReset} />}
        />
      )}
    </Box>
    <Box alignItems="center" gap="s" flexShrink={0} minHeight={32}>
      {children}
      <ToolbarActionsMenu groups={actions} />
    </Box>
  </Box>
)
