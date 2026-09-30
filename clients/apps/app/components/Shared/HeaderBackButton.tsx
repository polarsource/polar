import { Box } from '@/components/Shared/Box'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'

// The native iOS 26 back button stops responding after the second push above a
// `headerShown: false` screen (Home), so we render our own.
// https://github.com/software-mansion/react-native-screens/issues/3294
export const HeaderBackButton = () => {
  const theme = useTheme()
  const router = useRouter()

  return (
    <Touchable
      onPress={() => router.back()}
      hitSlop={16}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Box width={36} height={36} justifyContent="center" alignItems="center">
        <MaterialIcons
          name="arrow-back-ios-new"
          size={20}
          color={theme.colors.monochromeInverted}
        />
      </Box>
    </Touchable>
  )
}
