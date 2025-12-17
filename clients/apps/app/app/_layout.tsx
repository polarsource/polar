import { Box } from '@/components/Shared/Box'
import theme from '@/design-system/theme'
import { SessionProvider } from '@/providers/SessionProvider'
import { ExtensionStorage } from '@bacons/apple-targets'
import { useReactNavigationDevTools } from '@dev-plugins/react-navigation'
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular'
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif/400Regular_Italic'
import { useFonts } from '@expo-google-fonts/instrument-serif/useFonts'
import NetInfo from '@react-native-community/netinfo'
import * as Sentry from '@sentry/react-native'

import { ThemeProvider } from '@shopify/restyle'
import { onlineManager } from '@tanstack/react-query'
import { Slot, useNavigationContainerRef } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import React, { useCallback, useEffect } from 'react'
import { AppState } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

Sentry.init({
  dsn: 'https://3119a20edbb1d03021076301c21ea658@o4505046560538624.ingest.us.sentry.io/4510311296073728',

  enabled: !__DEV__,

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
})

// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
})

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync()

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected)
  })
})

export default Sentry.wrap(function RootLayout() {
  const navigationRef = useNavigationContainerRef()

  // @ts-ignore - Known type mismatch with dev tools
  useReactNavigationDevTools(navigationRef)

  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  })

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        ExtensionStorage.reloadWidget()
      }
    })

    return () => subscription.remove()
  }, [])

  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setAppIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      SplashScreen.hide()
    }
  }, [fontsLoaded])

  if (!fontsLoaded) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider theme={theme}>
          <SessionProvider>
            <Box
              flex={1}
              backgroundColor="background"
              onLayout={onLayoutRootView}
            >
              <Slot />
            </Box>
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
})
