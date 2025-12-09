import { ErrorFallback } from '@/components/Errors/Fallback'
import { TabButton, TabsNavigator } from '@/components/Shared/TabsNavigator'
import { useTheme } from '@/hooks/theme'
import { useAppOpenTracking } from '@/hooks/useAppOpenTracking'
import NotificationsProvider from '@/providers/NotificationsProvider'
import { PolarOrganizationProvider } from '@/providers/OrganizationProvider'
import { PolarClientProvider } from '@/providers/PolarClientProvider'
import { PolarQueryClientProvider } from '@/providers/PolarQueryClientProvider'
import { useSession } from '@/providers/SessionProvider'
import { UserProvider } from '@/providers/UserProvider'
import { DarkTheme, ThemeProvider } from '@react-navigation/native'
import { useQueryClient } from '@tanstack/react-query'
import { Redirect, useRouter } from 'expo-router'
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui'
import React from 'react'
import { ErrorBoundary as ErrorBoundaryComponent } from 'react-error-boundary'
import { StatusBar } from 'react-native'

const RootLayout = () => {
  const { theme } = useTheme()
  const { session } = useSession()
  const queryClient = useQueryClient()
  const router = useRouter()

  useAppOpenTracking()

  if (!session) {
    return <Redirect href="/" />
  }

  return (
    <ErrorBoundaryComponent
      onReset={() => {
        queryClient.clear()
        router.replace('/')
      }}
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
    >
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
      />

      <Tabs>
        <TabSlot />
        <TabList asChild>
          <TabsNavigator>
            <TabTrigger name="home" href="/(authenticated)/home" asChild>
              <TabButton icon="space-dashboard" />
            </TabTrigger>
            <TabTrigger name="orders" href="/(authenticated)/orders" asChild>
              <TabButton icon="short-text" />
            </TabTrigger>
            <TabTrigger
              name="customers"
              href="/(authenticated)/customers"
              asChild
            >
              <TabButton icon="people" />
            </TabTrigger>
          </TabsNavigator>
        </TabList>
      </Tabs>
    </ErrorBoundaryComponent>
  )
}

export default function Providers() {
  return (
    <ThemeProvider value={DarkTheme}>
      <PolarClientProvider>
        <PolarQueryClientProvider>
          <UserProvider>
            <NotificationsProvider>
              <PolarOrganizationProvider>
                <RootLayout />
              </PolarOrganizationProvider>
            </NotificationsProvider>
          </UserProvider>
        </PolarQueryClientProvider>
      </PolarClientProvider>
    </ThemeProvider>
  )
}
