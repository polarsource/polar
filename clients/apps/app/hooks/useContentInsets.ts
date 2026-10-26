import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const MEDIUM_LAYOUT_MIN_WIDTH = 640
const WIDE_LAYOUT_MIN_WIDTH = 760

export const useContentInsets = (maxWidth = Infinity) => {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  const availableWidth = width - insets.left - insets.right
  const centering = Math.max(0, (availableWidth - maxWidth) / 2)

  return {
    isMedium: availableWidth >= MEDIUM_LAYOUT_MIN_WIDTH,
    isWide: availableWidth >= WIDE_LAYOUT_MIN_WIDTH,
    paddingLeft: insets.left + centering,
    paddingRight: insets.right + centering,
  }
}
