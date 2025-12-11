import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { PropsWithChildren, useMemo } from 'react'
import { Box } from '../Shared/Box'
import { Text } from '../Shared/Text'
import { Touchable } from '../Shared/Touchable'

export interface SettingsItemProps extends PropsWithChildren {
  label: string
  variant: 'navigate' | 'select' | 'link'
  onPress: () => void
}

export const SettingsItem = ({
  label,
  variant,
  onPress,
  children,
}: SettingsItemProps) => {
  const theme = useTheme()

  const iconName: keyof typeof MaterialIcons.glyphMap = useMemo(() => {
    switch (variant) {
      case 'navigate':
        return 'chevron-right'
      case 'select':
        return 'unfold-more'
      case 'link':
        return 'arrow-outward'
    }
  }, [variant])

  return (
    <Touchable
      onPress={onPress}
      boxProps={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 'spacing-8',
        gap: 'spacing-12',
      }}
    >
      <Text variant="body">{label}</Text>
      <Box flexDirection="row" alignItems="center" gap="spacing-12">
        {children}
        <MaterialIcons
          name={iconName}
          size={variant === 'link' ? 16 : 20}
          color={theme.colors.subtext}
        />
      </Box>
    </Touchable>
  )
}
