import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const DUO_MODEL_ID = 'iPhone19,4'

export const useIsDuo = () => {
  const insets = useSafeAreaInsets()
  if (Platform.OS !== 'ios') return false
  if (Device.modelId === DUO_MODEL_ID) return true

  // The simulator reports the host machine as modelId, so fall back to the
  // one trait only the Duo has: a safe-area inset on a single side.
  return (insets.left === 0) !== (insets.right === 0)
}
