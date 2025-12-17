import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const useHomeHeaderHeight = () => {
  const insets = useSafeAreaInsets()

  const topSafeAreaHeight = insets.top
  const netHeaderHeight = 50
  const grossHeaderHeight = netHeaderHeight + topSafeAreaHeight

  return {
    topSafeAreaHeight,
    netHeaderHeight,
    grossHeaderHeight,
  }
}
