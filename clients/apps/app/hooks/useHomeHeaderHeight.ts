import { useSafeAreaInsets } from 'react-native-safe-area-context'

const MIN_TOP_SPACING = 16

export const useHomeHeaderHeight = () => {
  const insets = useSafeAreaInsets()

  const topSafeAreaHeight = Math.max(insets.top, MIN_TOP_SPACING)
  const netHeaderHeight = 50
  const grossHeaderHeight = netHeaderHeight + topSafeAreaHeight

  return {
    topSafeAreaHeight,
    netHeaderHeight,
    grossHeaderHeight,
  }
}
