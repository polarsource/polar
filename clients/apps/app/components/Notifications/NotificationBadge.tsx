import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { useNotificationsBadge } from '@/hooks/notifications'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Link } from 'expo-router'
import { TouchableOpacity } from 'react-native'

export const NotificationBadge = () => {
  const theme = useTheme()
  const showBadge = useNotificationsBadge()

  return (
    <Link href="/notifications" asChild>
      <TouchableOpacity activeOpacity={0.6} style={{ position: 'relative' }}>
        <MaterialIcons name="bolt" size={24} color={theme.colors.text} />
        {showBadge && (
          <Box
            backgroundColor="primary"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 4,
              height: 4,
              borderRadius: theme.borderRadii['border-radius-2'],
            }}
          />
        )}
      </TouchableOpacity>
    </Link>
  )
}
