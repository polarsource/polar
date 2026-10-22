import { useTheme } from '@/design-system/useTheme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const useHomeHeaderHeight = () => {
  const insets = useSafeAreaInsets()
  const theme = useTheme()

  const topSafeAreaHeight = Math.max(insets.top, theme.spacing['spacing-16'])
  const netHeaderHeight = 50
  const grossHeaderHeight = netHeaderHeight + topSafeAreaHeight

  return {
    topSafeAreaHeight,
    netHeaderHeight,
    grossHeaderHeight,
  }
}
