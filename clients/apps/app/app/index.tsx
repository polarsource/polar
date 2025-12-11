import { FadeInAndUp } from '@/components/Animations/FadeInAndUp'
import { KenBurns } from '@/components/Animations/KenBurns'
import { Box } from '@/components/Shared/Box'
import LogoIcon from '@/components/Shared/PolarLogo'
import { Text } from '@/components/Shared/Text'
import { Touchable } from '@/components/Shared/Touchable'
import { useTheme } from '@/design-system/useTheme'
import { useOAuth } from '@/hooks/oauth'
import { useSession } from '@/providers/SessionProvider'

import { Image } from '@/components/Shared/Image/Image'
import { Redirect } from 'expo-router'
import { StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function App() {
  const { session } = useSession()
  const theme = useTheme()
  const { authRequest, authenticate } = useOAuth()

  if (session) {
    return <Redirect href="/home" />
  }

  return (
    <SafeAreaView
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: theme.spacing['spacing-54'],
        backgroundColor: theme.colors.background,
      }}
    >
      <StatusBar barStyle="light-content" />

      <KenBurns>
        <Image
          source={require('@/assets/images/login-background.jpg')}
          style={{ width: '100%', height: '100%' }}
        />
      </KenBurns>

      <FadeInAndUp delay={300}>
        <LogoIcon size={80} />
      </FadeInAndUp>

      <FadeInAndUp delay={600}>
        <Text
          textAlign="center"
          variant="display"
          style={{
            marginHorizontal: theme.spacing['spacing-32'],
          }}
        >
          Monetize your software
        </Text>
      </FadeInAndUp>

      <FadeInAndUp delay={900}>
        <Touchable onPress={authenticate} disabled={!authRequest}>
          <Box
            paddingVertical="spacing-12"
            paddingHorizontal="spacing-24"
            backgroundColor="monochromeInverted"
            borderRadius="border-radius-100"
          >
            <Text variant="bodyMedium" color="monochrome" textAlign="center">
              Get Started
            </Text>
          </Box>
        </Touchable>
      </FadeInAndUp>
    </SafeAreaView>
  )
}
