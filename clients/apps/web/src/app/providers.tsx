'use client'

import { cookieConsentGiven } from '@/components/Privacy/CookieConsent'
import { DISTINCT_ID_COOKIE } from '@/experiments/constants'
import { NavigationHistoryProvider } from '@/providers/navigationHistory'
import { getQueryClient } from '@/utils/api/query'
import { CONFIG } from '@/utils/config'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { usePathname, useSearchParams } from 'next/navigation'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { PropsWithChildren } from 'react'

export { NavigationHistoryProvider }

if (typeof window !== 'undefined' && CONFIG.POSTHOG_TOKEN) {
  const distinctId = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${DISTINCT_ID_COOKIE}=`))
    ?.split('=')[1]

  posthog.init(CONFIG.POSTHOG_TOKEN, {
    ui_host: 'https://us.i.posthog.com',
    api_host: '/ingest',
    defaults: '2025-05-24', // enables automatic pageview tracking
    persistence: cookieConsentGiven() === 'yes' ? 'localStorage' : 'memory',
    bootstrap: distinctId ? { distinctID: distinctId } : undefined,
    disable_surveys: true,
  })
}

export function PolarPostHogProvider({
  children,
}: {
  children: React.ReactNode
}) {
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
