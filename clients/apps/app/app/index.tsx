import { FadeInAndUp } from '@/components/Animations/FadeInAndUp'
import { KenBurns } from '@/components/Animations/KenBurns'
import LogoIcon from '@/components/Shared/PolarLogo'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useTheme } from '@/design-system/useTheme'
import { useOAuth } from '@/hooks/oauth'
import { useSession } from '@/providers/SessionProvider'
import { Image } from 'expo-image'
import { Redirect } from 'expo-router'
import { StatusBar, Text, TouchableOpacity } from 'react-native'
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
        <ThemedText
          style={{
            fontSize: 58,
            textAlign: 'center',
            fontWeight: '500',
            lineHeight: 64,
            marginHorizontal: theme.spacing['spacing-32'],
            fontFamily: 'InstrumentSerif_400Regular',
          }}
        >
          Monetize your software
        </ThemedText>
      </FadeInAndUp>

      <FadeInAndUp delay={900}>
        <TouchableOpacity
          activeOpacity={0.6}
          disabled={!authRequest}
          style={{
            width: 'auto',
            paddingVertical: theme.spacing['spacing-12'],
            paddingHorizontal: theme.spacing['spacing-24'],
            backgroundColor: theme.colors.monochromeInverted,
            borderRadius: theme.borderRadii['border-radius-100'],
          }}
          onPress={authenticate}
        >
          <Text
            style={{
              fontSize: 16,
              textAlign: 'center',
              fontWeight: '500',
              lineHeight: 24,
              color: theme.colors.monochrome,
            }}
          >
            Get Started
          </Text>
        </TouchableOpacity>
      </FadeInAndUp>
    </SafeAreaView>
  )
}
