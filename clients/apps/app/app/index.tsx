import LogoIcon from '@/components/Shared/PolarLogo'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useOAuth } from '@/hooks/oauth'
import { useTheme } from '@/hooks/theme'
import { useSession } from '@/providers/SessionProvider'
import { Image } from 'expo-image'
import { Redirect } from 'expo-router'
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

export default function App() {
  const { session, setSession } = useSession()
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
      <Image
        source={require('@/assets/images/login-background.jpg')}
        style={LoginStyle.background}
      />
      <View>
        <LogoIcon size={80} />
      </View>
      <View>
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
      </View>
      <View>
        <TouchableOpacity
          activeOpacity={0.6}
          disabled={!authRequest}
          style={[
            LoginStyle.button,
            { backgroundColor: '#fff', borderRadius: 100 },
          ]}
          onPress={authenticate}
          onLongPress={() => {
            setSession(process.env.EXPO_PUBLIC_POLAR_DEMO_TOKEN ?? null)
          }}
        >
          <Text style={[LoginStyle.buttonText, { color: colors.monochrome }]}>
            Get Started
          </Text>
        </TouchableOpacity>
      </View>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
