import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { useContext } from 'react'
import { Avatar } from '../Shared/Avatar'
import { Text } from '../Shared/Text'
import { Tile } from './Tile'

export interface OrganizationTileProps {
  onPress: () => void
  loading?: boolean
}

export const OrganizationTile = ({
  onPress,
  loading,
}: OrganizationTileProps) => {
  const { organization } = useContext(OrganizationContext)
  const theme = useTheme()

  if (!organization) {
    return null
  }

  return (
    <Tile onPress={onPress}>
      <Box flex={1} flexDirection="column" justifyContent="space-between">
        <Avatar
          name={organization.name}
          image={organization.avatar_url}
          backgroundColor={
            organization.avatar_url ? undefined : theme.colors.primary
          }
        />
        <Box flexDirection="column" gap="spacing-4">
          <Text
            variant="subtitle"
            style={{ fontWeight: '600' }}
            loading={loading}
            placeholderText="Organization"
            placeholderNumberOfLines={2}
          >
            {organization.name}
          </Text>
          <Text
            variant="body"
            color="subtext"
            numberOfLines={1}
            loading={loading}
            placeholderText="org-slug"
          >
            {organization.slug}
          </Text>
        </Box>
      </Box>
    </Tile>
  )
}
