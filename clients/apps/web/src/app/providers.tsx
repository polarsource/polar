'use client'

import { cookieConsentGiven } from '@/components/Privacy/CookieConsent'
import { NavigationHistoryProvider } from '@/providers/navigationHistory'
import { getQueryClient } from '@/utils/api/query'
import { CONFIG } from '@/utils/config'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { usePathname, useSearchParams } from 'next/navigation'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { PropsWithChildren, useEffect } from 'react'

export { NavigationHistoryProvider }

export function PolarPostHogProvider({
  children,
  distinctId,
}: {
  children: React.ReactNode
  distinctId: string
}) {
  useEffect(() => {
    if (!CONFIG.POSTHOG_TOKEN) {
      return
    }

    posthog.init(CONFIG.POSTHOG_TOKEN, {
      ui_host: 'https://us.i.posthog.com',
      api_host: '/ingest',
      defaults: '2025-05-24', // this enables automatic pageview tracking
      persistence: cookieConsentGiven() === 'yes' ? 'localStorage' : 'memory',
      bootstrap: {
        distinctID: distinctId,
      },
    })
  }, [distinctId])

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}

export function PolarThemeProvider({
  children,
  forceTheme,
}: {
  children: React.ReactNode
  forceTheme?: 'light' | 'dark'
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const theme = searchParams.get('theme')

  const PAGES_WITH_FORCED_DARK_THEME: string[] = ['/midday/portal']
  const forcedTheme = PAGES_WITH_FORCED_DARK_THEME.some((path) =>
    pathname.includes(path),
  )
    ? 'dark'
    : forceTheme

  return (
    <ThemeProvider
      defaultTheme="system"
      enableSystem
      attribute="class"
      forcedTheme={theme ?? forcedTheme}
    >
      {children}
    </ThemeProvider>
  )
}

export function PolarQueryClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

export function PolarNuqsProvider({ children }: PropsWithChildren) {
  return <NuqsAdapter>{children}</NuqsAdapter>
}
