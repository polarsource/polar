import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { useNotificationsBadge } from '@/hooks/notifications'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Link } from 'expo-router'
import { StyleSheet, TouchableOpacity } from 'react-native'

export const NotificationBadge = () => {
  const theme = useTheme()
  const showBadge = useNotificationsBadge()

  return (
    <Link href="/notifications" asChild>
      <TouchableOpacity activeOpacity={0.6} style={styles.container}>
        <MaterialIcons name="bolt" size={24} color={theme.colors.text} />
        {showBadge && <Box style={styles.badge} backgroundColor="primary" />}
      </TouchableOpacity>
    </Link>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
})
