import { useTheme } from '@/design-system/useTheme'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { router } from 'expo-router'
import { useContext } from 'react'
import { Avatar } from '../Shared/Avatar'
import { BottomSheet } from '../Shared/BottomSheet'
import { Box } from '../Shared/Box'
import { Button } from '../Shared/Button'
import { Text } from '../Shared/Text'
import { Touchable } from '../Shared/Touchable'

export interface OrganizationsSheetProps {
  onDismiss: () => void
  onSelect?: () => void
}

export const OrganizationsSheet = ({
  onDismiss,
  onSelect,
}: OrganizationsSheetProps) => {
  const {
    setOrganization,
    organization: selectedOrganization,
    organizations,
  } = useContext(OrganizationContext)

  const theme = useTheme()

  return (
    <BottomSheet
      onDismiss={onDismiss}
      snapPoints={['40%']}
      enableDynamicSizing={false}
    >
      <Box gap="spacing-16">
        <Box flexDirection="row" justifyContent="space-between">
          <Text variant="title">Organizations</Text>
          <Button
            size="small"
            onPress={() => router.push('/onboarding')}
            icon={
              <MaterialIcons
                name="add"
                size={16}
                color={theme.colors.monochrome}
              />
            }
          >
            New
          </Button>
        </Box>
        <Box flexDirection="column">
          {organizations.map((organization) => (
            <Touchable
              key={organization?.id}
              style={{
                paddingVertical: theme.spacing['spacing-12'],
                paddingLeft: theme.spacing['spacing-16'],
                paddingRight: theme.spacing['spacing-24'],
                borderRadius: theme.borderRadii['border-radius-16'],
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing['spacing-12'],
                justifyContent: 'space-between',
                backgroundColor:
                  selectedOrganization?.id === organization?.id
                    ? theme.colors.card
                    : undefined,
              }}
              onPress={() => {
                const didSwitch = selectedOrganization?.id !== organization?.id
                setOrganization(organization)
                onDismiss()
                if (didSwitch) {
                  onSelect?.()
                }
              }}
              activeOpacity={0.6}
            >
              <Box flexDirection="row" alignItems="center" gap="spacing-12">
                <Avatar
                  size={24}
                  image={organization?.avatar_url}
                  name={organization?.name}
                />
                <Text>{organization?.name}</Text>
              </Box>
              {selectedOrganization?.id === organization?.id ? (
                <MaterialIcons
                  name="check"
                  size={20}
                  color={theme.colors.monochromeInverted}
                />
              ) : null}
            </Touchable>
          ))}
        </Box>
      </Box>
    </BottomSheet>
  )
}
