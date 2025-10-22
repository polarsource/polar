'use client'

import { cookieConsentGiven } from '@/components/Privacy/CookieConsent'
import { getQueryClient } from '@/utils/api/query'
import { CONFIG } from '@/utils/config'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryStreamedHydration } from '@tanstack/react-query-next-experimental'
import { ThemeProvider } from 'next-themes'
import { usePathname, useSearchParams } from 'next/navigation'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { PropsWithChildren, useEffect } from 'react'

export function PolarPostHogProvider({
  children,
}: {
  children: React.ReactNode
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
    })
  }, [])

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
    <QueryClientProvider client={queryClient}>
      <ReactQueryStreamedHydration>{children}</ReactQueryStreamedHydration>
    </QueryClientProvider>
  )
}

export function PolarNuqsProvider({ children }: PropsWithChildren) {
  return <NuqsAdapter>{children}</NuqsAdapter>
}
