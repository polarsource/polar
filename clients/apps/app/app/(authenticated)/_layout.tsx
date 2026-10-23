import { ErrorFallback } from '@/components/Errors/Fallback'
import { colors } from '@/design-system/theme'
import { useTheme } from '@/design-system/useTheme'
import { useAppOpenTracking } from '@/hooks/useAppOpenTracking'
import { useContentInsets } from '@/hooks/useContentInsets'
import DeepLinkProvider from '@/providers/DeepLinkProvider'
import NotificationsProvider from '@/providers/NotificationsProvider'
import { PolarOrganizationProvider } from '@/providers/OrganizationProvider'
import { PolarClientProvider } from '@/providers/PolarClientProvider'
import { PolarQueryClientProvider } from '@/providers/PolarQueryClientProvider'
import { useSession } from '@/providers/SessionProvider'
import { ToastProvider } from '@/providers/ToastProvider'
import { UserProvider } from '@/providers/UserProvider'
import { useQueryClient } from '@tanstack/react-query'
import {
  DarkTheme,
  Redirect,
  Stack,
  ThemeProvider,
  useRouter,
} from 'expo-router'
import { PropsWithChildren } from 'react'
import { ErrorBoundary as ErrorBoundaryComponent } from 'react-error-boundary'
import { StatusBar } from 'react-native'

const MAX_CONTENT_WIDTH = 600

const navigationTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background },
}

const AuthenticatedErrorBoundary = ({ children }: PropsWithChildren) => {
  const queryClient = useQueryClient()
  const router = useRouter()

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
      {children}
    </ErrorBoundaryComponent>
  )
}

const RootLayout = () => {
  const theme = useTheme()
  const { session } = useSession()
  const { paddingLeft, paddingRight } = useContentInsets(MAX_CONTENT_WIDTH)

  useAppOpenTracking()

  if (!session) {
    return <Redirect href="/" />
  }

  return (
    <>
      <StatusBar barStyle="light-content" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.background,
          },
          headerTitleStyle: {
            color: theme.colors.text,
            fontSize: 18,
          },
          contentStyle: {
            backgroundColor: theme.colors.background,
            paddingLeft,
            paddingRight,
          },
          headerShadowVisible: false,
        }}
      />
    </>
  )
}

export default function Providers() {
  return (
    <ThemeProvider value={navigationTheme}>
      <PolarClientProvider>
        <PolarQueryClientProvider>
          <DeepLinkProvider>
            <NotificationsProvider>
              <AuthenticatedErrorBoundary>
                <UserProvider>
                  <PolarOrganizationProvider>
                    <ToastProvider>
                      <RootLayout />
                    </ToastProvider>
                  </PolarOrganizationProvider>
                </UserProvider>
              </AuthenticatedErrorBoundary>
            </NotificationsProvider>
          </DeepLinkProvider>
        </PolarQueryClientProvider>
      </PolarClientProvider>
    </ThemeProvider>
  )
}
