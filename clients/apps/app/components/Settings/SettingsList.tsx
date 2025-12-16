import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { PropsWithChildren, useMemo } from 'react'
import { Box } from '../Shared/Box'
import { Text } from '../Shared/Text'
import { Touchable } from '../Shared/Touchable'

type BaseSettingsItemProps = PropsWithChildren<{
  title: string
  description?: string
}>

interface StaticSettingsItemProps extends BaseSettingsItemProps {
  variant: 'static'
}

interface TouchableSettingsItemProps extends BaseSettingsItemProps {
  variant: 'navigate' | 'select' | 'link'
  onPress: () => void
}

export type SettingsItemProps =
  | StaticSettingsItemProps
  | TouchableSettingsItemProps

export const SettingsItem = ({
  title,
  variant,
  description,
  children,
  ...props
}: SettingsItemProps) => {
  if (variant === 'static') {
    return (
      <StaticSettingsItem
        title={title}
        variant={variant}
        description={description}
      >
        {children}
      </StaticSettingsItem>
    )
  }

  return (
    <TouchableSettingsItem
      title={title}
      variant={variant}
      onPress={(props as TouchableSettingsItemProps).onPress}
      description={description}
    >
      {children}
    </TouchableSettingsItem>
  )
}

const StaticSettingsItem = ({
  title,
  description,
  children,
}: StaticSettingsItemProps) => {
  return (
    <Box
      flexDirection="row"
      gap="spacing-4"
      justifyContent="space-between"
      alignItems={description ? 'flex-start' : 'center'}
      paddingVertical="spacing-8"
    >
      <Box flexDirection="column" gap="spacing-2" maxWidth="80%">
        <Text variant="body">{title}</Text>
        {description ? (
          <Text variant="bodySmall" color="subtext">
            {description}
          </Text>
        ) : null}
      </Box>
      <Box flexDirection="row" alignItems="center" gap="spacing-12">
        {children}
      </Box>
    </Box>
  )
}

const TouchableSettingsItem = ({
  title,
  variant,
  onPress,
  description,
  children,
}: TouchableSettingsItemProps) => {
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
    <Touchable onPress={onPress}>
      <Box
        flexDirection="row"
        gap="spacing-4"
        alignItems={description ? 'flex-start' : 'center'}
        justifyContent="space-between"
        paddingVertical="spacing-8"
      >
        <Box flexDirection="column" gap="spacing-2" maxWidth="70%">
          <Text variant="body">{title}</Text>
          {description ? (
            <Text variant="bodySmall" color="subtext">
              {description}
            </Text>
          ) : null}
        </Box>
        <Box flexDirection="row" alignItems="center" gap="spacing-12">
          {children}
          <MaterialIcons
            name={iconName}
            size={variant === 'link' ? 16 : 20}
            color={theme.colors.subtext}
          />
        </Box>
      </Box>
    </Touchable>
  )
}
