import { FadeInAndUp } from '@/components/Animations/FadeInAndUp'
import { KenBurns } from '@/components/Animations/KenBurns'
import LogoIcon from '@/components/Shared/PolarLogo'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useOAuth } from '@/hooks/oauth'
import { useTheme } from '@/hooks/theme'
import { useSession } from '@/providers/SessionProvider'
import { Image } from 'expo-image'
import { Redirect } from 'expo-router'
import { StatusBar, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function App() {
  const { session } = useSession()
  const { colors } = useTheme()
  const { authRequest, authenticate } = useOAuth()

  if (session) {
    return <Redirect href="/home" />
  }

  return (
    <SafeAreaView
      style={[LoginStyle.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle="light-content" />

      <KenBurns>
        <Image
          source={require('@/assets/images/login-background.jpg')}
          style={LoginStyle.background}
        />
      </KenBurns>

      <FadeInAndUp delay={300}>
        <LogoIcon size={80} />
      </FadeInAndUp>

      <FadeInAndUp delay={600}>
        <ThemedText
          style={[
            LoginStyle.title,
            {
              fontFamily: 'InstrumentSerif_400Regular',
            },
          ]}
        >
          Monetize your software
        </ThemedText>
      </FadeInAndUp>

      <FadeInAndUp delay={900}>
        <TouchableOpacity
          activeOpacity={0.6}
          disabled={!authRequest}
          style={[
            LoginStyle.button,
            { backgroundColor: '#fff', borderRadius: 100 },
          ]}
          onPress={authenticate}
        >
          <Text style={[LoginStyle.buttonText, { color: colors.monochrome }]}>
            Get Started
          </Text>
        </TouchableOpacity>
      </FadeInAndUp>
    </SafeAreaView>
  )
}

const LoginStyle = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 54,
  },
  background: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 58,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 64,
    marginHorizontal: 32,
  },
  button: {
    width: 'auto',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 24,
  },
})
