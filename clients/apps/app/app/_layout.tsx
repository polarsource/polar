import React from "react";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { Slot, useNavigationContainerRef } from "expo-router";
import { SessionProvider } from "@/providers/SessionProvider";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "@expo-google-fonts/instrument-serif/useFonts";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif/400Regular";
import { InstrumentSerif_400Regular_Italic } from "@expo-google-fonts/instrument-serif/400Regular_Italic";
import { useCallback } from "react";
import { themes } from "@/utils/theme";
import { MotiView } from "moti";
import { useReactNavigationDevTools } from "@dev-plugins/react-navigation";
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://3119a20edbb1d03021076301c21ea658@o4505046560538624.ingest.us.sentry.io/4510311296073728',

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
});

// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

export default Sentry.wrap(function RootLayout() {
  const navigationRef = useNavigationContainerRef();

  // @ts-ignore - Known type mismatch with dev tools
  useReactNavigationDevTools(navigationRef);

  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });

  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setAppIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      SplashScreen.hide();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SessionProvider>
      <MotiView
        style={{ flex: 1, backgroundColor: themes.dark.background }}
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: "timing" }}
        onLayout={onLayoutRootView}
      >
        <Slot />
      </MotiView>
    </SessionProvider>
  );
});