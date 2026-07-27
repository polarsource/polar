import { useHasPermission } from '@/hooks/permissions'
import { OrganizationPermission } from '@/hooks/queries/roles'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { permissionDeniedMessage } from '@/utils/permissions'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { BrickWallShieldIcon } from 'lucide-react'
import { PropsWithChildren, useContext } from 'react'
import { WidgetContainer } from './WidgetContainer'

interface WidgetRestrictedProps {
  permission: OrganizationPermission
  title: string
  className?: string
}

export const WidgetRestricted = ({
  permission,
  title,
  className,
}: WidgetRestrictedProps) => (
  <WidgetContainer title={title} className={className}>
    <Box
      flex={1}
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      rowGap="s"
      marginBottom="xl"
      padding="2xl"
      borderRadius="s"
      backgroundColor="background-card"
      textAlign="center"
    >
      <BrickWallShieldIcon
        className="dark:text-polar-500 size-5 shrink-0 text-gray-500"
        strokeWidth={1.5}
      />
      <Text variant="body" as="h3">
        Restricted access
      </Text>
      <Text variant="default" color="muted">
        {permissionDeniedMessage(permission)}
      </Text>
    </Box>
  </WidgetContainer>
)

/**
 * Gates a dashboard widget on an organization permission.
 *
 * On denial the children are never mounted, so the widget's queries cannot
 * fire and widget bodies stay permission-unaware.
 */
export const WidgetGuard = ({
  permission,
  title,
  className,
  children,
}: PropsWithChildren<WidgetRestrictedProps>) => {
  const { organization } = useContext(OrganizationContext)
  const allowed = useHasPermission(organization.id, permission)

  if (!allowed) {
    return (
      <WidgetRestricted
        permission={permission}
        title={title}
        className={className}
      />
    )
  }

  return children
}
